/**
 * Payment events → subscription state.
 *
 * The rules the owner chose:
 *  • purchase           → activate the plan and allocate its included credits
 *  • cancel             → keep everything until the paid period ends
 *  • upgrade            → applies immediately (new credits allocated)
 *  • downgrade          → remembered and applied at the next renewal
 *  • failed payment     → plan features stay, credit spending pauses
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyWebhook, type PaddleEnv } from "@/lib/paddle.server";

let _db: SupabaseClient | null = null;
function db() {
  if (!_db) {
    _db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
      auth: { persistSession: false },
    });
  }
  return _db;
}

type Item = {
  price?: { import_meta?: { external_id?: string | null } | null; unit_price?: { amount?: string } };
  product?: { import_meta?: { external_id?: string | null } | null };
};

/** The plan key is carried on the product (or price) as its readable id. */
function planKeyOf(items: Item[] | undefined): string | null {
  const item = items?.[0];
  const product = item?.product?.import_meta?.external_id;
  if (product) return product;
  const price = item?.price?.import_meta?.external_id;
  return price ? price.replace(/_(monthly|yearly)$/, "") : null;
}

/** Monthly or yearly, taken from the price the customer actually bought. */
function intervalOf(items: Item[] | undefined): "monthly" | "yearly" {
  const price = items?.[0]?.price?.import_meta?.external_id ?? "";
  return price.endsWith("_yearly") ? "yearly" : "monthly";
}

async function subscriptionRow(providerSubId: string) {
  const { data } = await db()
    .from("subscriptions")
    .select("id, user_id, plan_id, final_price, period_end")
    .eq("provider_subscription_id", providerSubId)
    .eq("status", "active")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as
    | { id: string; user_id: string; plan_id: string | null; final_price: number | null; period_end: string | null }
    | null;
}

/** Live retail price of a plan, used to tell an upgrade from a downgrade. */
async function livePrice(planKey: string): Promise<number> {
  const { data: plan } = await db().from("plans").select("id").eq("key", planKey).maybeSingle();
  if (!plan) return 0;
  const { data: version } = await db()
    .from("plan_versions")
    .select("price")
    .eq("plan_id", (plan as { id: string }).id)
    .eq("status", "published")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number((version as { price?: number } | null)?.price ?? 0);
}

async function activate(input: {
  userId: string;
  planKey: string;
  providerSubId: string;
  amount: number | null;
  periodEnd: string | null;
  customerId: string | null;
  billingInterval?: "monthly" | "yearly";
}) {
  const { error } = await db().rpc("paddle_activate_paid_plan", {
    _user_id: input.userId,
    _plan_key: input.planKey,
    _provider_sub_id: input.providerSubId,
    _amount: input.amount,
    _period_end: input.periodEnd,
    _customer_id: input.customerId,
    _billing_interval: input.billingInterval ?? "monthly",
  });
  if (error) throw new Error(error.message);
}

const money = (items: Item[] | undefined) => {
  const amount = items?.[0]?.price?.unit_price?.amount;
  return amount ? Number(amount) / 100 : null;
};

async function onSubscriptionCreated(data: Record<string, any>, _env: PaddleEnv) {
  const userId = data["custom_data"]?.userId as string | undefined;
  const planKey = planKeyOf(data["items"]);
  if (!userId || !planKey) {
    console.warn("Purchase ignored: missing userId or plan key", { planKey });
    return;
  }
  await activate({
    userId,
    planKey,
    providerSubId: String(data["id"]),
    amount: money(data["items"]),
    periodEnd: data["current_billing_period"]?.ends_at ?? null,
    customerId: (data["customer_id"] as string) ?? null,
    billingInterval: intervalOf(data["items"]),
  });
}

async function onSubscriptionUpdated(data: Record<string, any>, _env: PaddleEnv) {
  const providerSubId = String(data["id"]);
  const row = await subscriptionRow(providerSubId);
  const planKey = planKeyOf(data["items"]);
  const status = String(data["status"] ?? "");

  // A failed renewal: keep the plan, pause chargeable generation.
  if (status === "past_due") {
    await db().rpc("paddle_set_payment_state", { _provider_sub_id: providerSubId, _state: "past_due" });
    return;
  }

  // Scheduled cancellation — access runs to the end of the paid period.
  if (data["scheduled_change"]?.action === "cancel") {
    await db().rpc("paddle_cancel_at_period_end", {
      _provider_sub_id: providerSubId,
      _period_end: data["scheduled_change"]?.effective_at ?? data["current_billing_period"]?.ends_at ?? null,
    });
    return;
  }

  if (status === "active") {
    await db().rpc("paddle_set_payment_state", { _provider_sub_id: providerSubId, _state: "ok" });
  }

  if (!row || !planKey || planKey === row.plan_id) return;

  const [next, current] = await Promise.all([livePrice(planKey), Promise.resolve(Number(row.final_price ?? 0))]);
  if (next > current) {
    // Upgrade: apply now and top the wallet up with the new allowance.
    await activate({
      userId: row.user_id,
      planKey,
      providerSubId,
      amount: money(data["items"]),
      periodEnd: data["current_billing_period"]?.ends_at ?? null,
      customerId: (data["customer_id"] as string) ?? null,
      billingInterval: intervalOf(data["items"]),
    });
  } else {
    // Downgrade: the locked rate stands until the period renews.
    await db().rpc("paddle_schedule_plan_change", { _provider_sub_id: providerSubId, _plan_key: planKey });
  }
}

async function onSubscriptionCanceled(data: Record<string, any>) {
  await db().rpc("paddle_cancel_at_period_end", {
    _provider_sub_id: String(data["id"]),
    _period_end: data["current_billing_period"]?.ends_at ?? null,
  });
}

/** A bought credit pack: its credits land in the wallet exactly once. */
async function onCreditPurchase(data: Record<string, any>): Promise<boolean> {
  const userId = data["custom_data"]?.userId as string | undefined;
  const externalId = (data["items"] as Item[] | undefined)?.[0]?.price?.import_meta?.external_id ?? null;
  if (!userId || !externalId || !externalId.startsWith("credits_")) return false;

  const { creditsForPack } = await import("@/lib/credits/topups.server");
  const packCredits = await creditsForPack(externalId);
  if (!packCredits) {
    console.warn("Credit purchase ignored: unknown pack", { externalId });
    return true;
  }

  const total = data["details"]?.totals?.grand_total;
  const { error } = await db().rpc("paddle_record_topup", {
    _user_id: userId,
    _provider_ref: String(data["id"]),
    _credits: packCredits,
    _amount: total ? Number(total) / 100 : 0,
    _currency: data["currency_code"] ?? "GBP",
  });
  if (error) throw new Error(error.message);
  return true;
}

/** A renewal payment: new period, fresh credits, any downgrade applied. */
async function onTransactionCompleted(data: Record<string, any>) {
  if (await onCreditPurchase(data)) return;

  const providerSubId = data["subscription_id"] as string | undefined;
  if (!providerSubId) return;
  if (data["origin"] === "subscription_charge" || data["origin"] === "web") return; // first charge handled on creation

  const { data: row } = await db()
    .from("subscriptions")
    .select("user_id, plan_id, scheduled_plan_id, billing_interval")
    .eq("provider_subscription_id", providerSubId)
    .eq("status", "active")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = row as {
    user_id: string;
    plan_id: string | null;
    scheduled_plan_id: string | null;
    billing_interval: string | null;
  } | null;
  if (!sub) return;

  const planKey = sub.scheduled_plan_id ?? sub.plan_id;
  if (!planKey) return;

  await activate({
    userId: sub.user_id,
    planKey,
    providerSubId,
    amount: data["details"]?.totals?.grand_total ? Number(data["details"].totals.grand_total) / 100 : null,
    periodEnd: data["billing_period"]?.ends_at ?? null,
    customerId: (data["customer_id"] as string) ?? null,
    // A renewal keeps the interval the customer originally bought.
    billingInterval: sub.billing_interval === "yearly" ? "yearly" : "monthly",
  });
}

async function onPaymentFailed(data: Record<string, any>) {
  const providerSubId = data["subscription_id"] as string | undefined;
  if (!providerSubId) return;
  await db().rpc("paddle_set_payment_state", { _provider_sub_id: providerSubId, _state: "past_due" });
}

/**
 * The provider retries for days, so every event is claimed before it is acted
 * on. A duplicate delivery finds its row already there and stops.
 */
async function claim(event: { event_id?: string; event_type: string }, env: PaddleEnv, payload: unknown) {
  const eventId = event.event_id;
  if (!eventId) return true;
  const { error } = await db().from("payment_events").insert({
    provider: "paddle",
    event_id: eventId,
    event_type: event.event_type,
    environment: env,
    status: "processing",
    payload: payload as never,
  });
  if (error) {
    console.log("Duplicate payment event ignored:", eventId);
    return false;
  }
  return true;
}

async function settle(eventId: string | undefined, status: string, error?: string) {
  if (!eventId) return;
  if (status === "failed") {
    // Release the claim so the provider's retry can be processed properly.
    await db().from("payment_events").delete().eq("provider", "paddle").eq("event_id", eventId);
    console.error("Payment event released for retry:", eventId, error);
    return;
  }
  await db()
    .from("payment_events")
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .eq("provider", "paddle")
    .eq("event_id", eventId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = ((new URL(request.url).searchParams.get("env") || "sandbox") as PaddleEnv);
        let eventId: string | undefined;
        try {
          const event = (await verifyWebhook(request, env)) as {
            event_type: string;
            event_id?: string;
            data: Record<string, unknown>;
          };
          eventId = event.event_id;
          if (!(await claim(event, env, event))) return Response.json({ received: true, duplicate: true });

          switch (event.event_type) {
            case "subscription.created":
              await onSubscriptionCreated(event.data as Record<string, any>, env);
              break;
            case "subscription.updated":
              await onSubscriptionUpdated(event.data as Record<string, any>, env);
              break;
            case "subscription.canceled":
              await onSubscriptionCanceled(event.data as Record<string, any>);
              break;
            case "transaction.completed":
              await onTransactionCompleted(event.data as Record<string, any>);
              break;
            case "transaction.payment_failed":
              await onPaymentFailed(event.data as Record<string, any>);
              break;
            default:
              console.log("Unhandled payment event:", event.event_type);
          }
          await settle(eventId, "processed");
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payment webhook error:", e);
          await settle(eventId, "failed", (e as Error).message);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

