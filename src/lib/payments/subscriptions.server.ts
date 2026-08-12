/**
 * Managing a subscription that already exists at the provider: changing plan,
 * cancelling, and opening the provider's billing portal. Nothing here creates a
 * second subscription — that is the bug this file exists to prevent.
 */
import { paddleFetch, type PaddleEnv } from "@/lib/paddle.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Live = {
  id: string;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  planKey: string;
  price: number;
};

/** The caller's current paid subscription, as the provider knows it. */
export async function liveSubscription(userId: string): Promise<Live | null> {
  const db = await admin();
  const { data } = await db
    .from("subscriptions")
    .select("id, provider_subscription_id, provider_customer_id, plan_id, plan, final_price")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    providerSubscriptionId: (data.provider_subscription_id as string) ?? null,
    providerCustomerId: (data.provider_customer_id as string) ?? null,
    planKey: String(data.plan_id ?? data.plan),
    price: Number(data.final_price ?? 0),
  };
}

async function publishedPrice(planKey: string) {
  const db = await admin();
  const { data: plan } = await db.from("plans").select("id").eq("key", planKey).maybeSingle();
  if (!plan) return 0;
  const { data } = await db
    .from("plan_versions")
    .select("price")
    .eq("plan_id", String(plan.id))
    .eq("status", "published")
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number((data as { price?: number } | null)?.price ?? 0);
}

async function providerPriceId(env: PaddleEnv, externalId: string) {
  const res = await paddleFetch(env, `/prices?external_id=${encodeURIComponent(externalId)}&status=active`);
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  const id = body.data?.[0]?.id;
  if (!id) throw new Error("That plan is not available for purchase yet.");
  return id;
}

/**
 * Moves an existing subscription onto another paid plan. Upgrades are charged
 * straight away; downgrades keep the paid rate and take effect at renewal.
 */
export async function changePlan(input: { userId: string; planKey: string; env: PaddleEnv }) {
  const current = await liveSubscription(input.userId);
  if (!current?.providerSubscriptionId) throw new Error("You do not have a paid subscription to change.");
  if (current.planKey === input.planKey) return { changed: false as const, direction: "same" as const };

  const next = await publishedPrice(input.planKey);
  if (!(next > 0)) throw new Error("Choose a paid plan, or start the free plan instead.");
  const upgrade = next > current.price;

  const priceId = await providerPriceId(input.env, `${input.planKey}_monthly`);
  await paddleFetch(input.env, `/subscriptions/${current.providerSubscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      proration_billing_mode: upgrade ? "prorated_immediately" : "do_not_bill",
    }),
  });

  const db = await admin();
  if (!upgrade) {
    // The new, lower allowance starts when the paid period runs out.
    await db.rpc("paddle_schedule_plan_change", {
      _provider_sub_id: current.providerSubscriptionId,
      _plan_key: input.planKey,
    });
  }

  return { changed: true as const, direction: upgrade ? ("upgrade" as const) : ("downgrade" as const) };
}

/** Cancels at the end of the paid period — access is never cut short. */
export async function cancelPlan(input: { userId: string; env: PaddleEnv }) {
  const current = await liveSubscription(input.userId);
  if (!current?.providerSubscriptionId) throw new Error("You do not have a paid subscription to cancel.");

  const res = await paddleFetch(input.env, `/subscriptions/${current.providerSubscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ effective_from: "next_billing_period" }),
  });
  const body = (await res.json()) as { data?: { scheduled_change?: { effective_at?: string } } };

  const db = await admin();
  await db.rpc("paddle_cancel_at_period_end", {
    _provider_sub_id: current.providerSubscriptionId,
    _period_end: body.data?.scheduled_change?.effective_at ?? undefined,
  });

  return { cancelAt: body.data?.scheduled_change?.effective_at ?? null };
}

/** A short-lived link to the provider's own portal for cards and invoices. */
export async function billingPortalUrl(input: { userId: string; env: PaddleEnv }) {
  const current = await liveSubscription(input.userId);
  if (!current?.providerCustomerId) throw new Error("There is no payment record on this account yet.");

  const res = await paddleFetch(input.env, `/customers/${current.providerCustomerId}/portal-sessions`, {
    method: "POST",
    body: JSON.stringify(
      current.providerSubscriptionId ? { subscription_ids: [current.providerSubscriptionId] } : {},
    ),
  });
  const body = (await res.json()) as {
    data?: { urls?: { general?: { overview?: string }; subscriptions?: Array<{ update_payment_method?: string }> } };
  };
  const url =
    body.data?.urls?.subscriptions?.[0]?.update_payment_method ?? body.data?.urls?.general?.overview ?? null;
  if (!url) throw new Error("The billing portal is not available right now.");
  return { url };
}
