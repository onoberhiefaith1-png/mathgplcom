import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StripeConnectStatus = {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  paymentsActive: boolean;
  /** Stripe's own reason the account cannot charge yet, when it gives one. */
  disabledReason: string | null;
  /** What Stripe is still waiting for, in its own field names. */
  requirements: string[];
};


/**
 * Where this workspace stands with Stripe. Read from Stripe itself whenever an
 * account exists, so verification progress is never stale.
 */
export const getStripeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ownerKind: z.enum(["teacher", "school"]) }).parse(data))
  .handler(async ({ data, context }): Promise<StripeConnectStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("owner_kind", data.ownerKind)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return {
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        paymentsActive: false,
        disabledReason: null,
        requirements: [],
      };
    }

    const { retrieveAccount } = await import("./stripeConnect.server");
    const account = await retrieveAccount(row.stripe_account_id);

    await supabaseAdmin
      .from("gateway_payout_accounts")
      .update({
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        status: account.charges_enabled ? "verified" : "pending",
        payments_active: account.charges_enabled ? row.payments_active : false,
      })
      .eq("id", row.id);

    return {
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: account.details_submitted,
      paymentsActive: Boolean(account.charges_enabled && row.payments_active),
      disabledReason: account.requirements?.disabled_reason ?? null,
      requirements: [
        ...(account.requirements?.past_due ?? []),
        ...(account.requirements?.currently_due ?? []),
      ].filter((entry, index, all) => all.indexOf(entry) === index),
    };

  });

/** Hands the owner over to Stripe's own onboarding and verification flow. */
export const startStripeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ownerKind: z.enum(["teacher", "school"]), origin: z.string().url().max(300) }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createConnectedAccount, createAccountLink, platformReadiness, PLATFORM_NOT_READY } = await import(
      "./stripeConnect.server"
    );

    // The platform must be a live Connect platform before a teacher can onboard.
    const readiness = await platformReadiness();
    if (!readiness.ready) {
      console.error(`Stripe Connect onboarding blocked: ${readiness.reason}`);
      throw new Error(PLATFORM_NOT_READY);
    }

    const { data: existing } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("owner_kind", data.ownerKind)
      .maybeSingle();

    let accountId = existing?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await createConnectedAccount({
        email: (context.claims as { email?: string } | null)?.email ?? null,
        ownerKind: data.ownerKind,
        ownerId: context.userId,
      });
      accountId = account.id;

      const payload = {
        owner_id: context.userId,
        owner_kind: data.ownerKind,
        provider: "stripe",
        stripe_account_id: accountId,
        external_account_id: accountId,
        status: "pending",
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
      };

      if (existing) {
        await supabaseAdmin.from("gateway_payout_accounts").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("gateway_payout_accounts").insert(payload);
      }
    }

    const back = `${data.origin}/${data.ownerKind === "school" ? "school" : "teaching-hub"}/pricing`;
    const link = await createAccountLink(
      accountId,
      `${back}?stripe=refresh`,
      `${back}?stripe=return`,
    );
    return { url: link.url };
  });

/**
 * Throws away an empty Stripe account and starts a clean one.
 *
 * Only ever allowed while Stripe itself says nothing has been submitted on that
 * account, so an owner who is half-way through verification — or already
 * verified — can never lose their real account here.
 */
export const resetStripeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ownerKind: z.enum(["teacher", "school"]) }).parse(data))
  .handler(async ({ data, context }): Promise<{ reset: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("owner_kind", data.ownerKind)
      .maybeSingle();
    if (!row?.stripe_account_id) return { reset: false };

    const { retrieveAccount } = await import("./stripeConnect.server");
    const account = await retrieveAccount(row.stripe_account_id);
    if (account.details_submitted || account.charges_enabled) {
      throw new Error("This Stripe account already holds your details, so it is kept as it is.");
    }

    await supabaseAdmin
      .from("gateway_payout_accounts")
      .update({
        stripe_account_id: null,
        external_account_id: null,
        status: "pending",
        charges_enabled: false,
        details_submitted: false,
        payments_active: false,
      })
      .eq("id", row.id);

    return { reset: true };
  });



/** A link straight into the owner's own Stripe dashboard. */
export const openStripeDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ownerKind: z.enum(["teacher", "school"]) }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("stripe_account_id")
      .eq("owner_id", context.userId)
      .eq("owner_kind", data.ownerKind)
      .maybeSingle();
    if (!row?.stripe_account_id) throw new Error("Connect Stripe first.");

    const { createLoginLink } = await import("./stripeConnect.server");
    const link = await createLoginLink(row.stripe_account_id);
    return { url: link.url };
  });

/** The owner's own switch. Payment stays invisible to students until it is on. */
export const setPaymentsActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ownerKind: z.enum(["teacher", "school"]), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }): Promise<{ paymentsActive: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("owner_kind", data.ownerKind)
      .maybeSingle();

    if (!row?.stripe_account_id) throw new Error("Connect Stripe first.");
    if (data.active && !row.charges_enabled) {
      throw new Error("Stripe has not finished verifying this account yet.");
    }

    await supabaseAdmin
      .from("gateway_payout_accounts")
      .update({ payments_active: data.active })
      .eq("id", row.id);

    return { paymentsActive: data.active };
  });

/**
 * Opens Stripe Checkout for a paid gateway plan, on the owner's connected
 * account. Access is not granted here — only Stripe's webhook may do that.
 */
export const createPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planId: z.string().uuid(), interval: z.enum(["one_off", "monthly", "yearly"]), origin: z.string().url().max(300), returnPath: z.string().max(200).regex(/^\//).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("gateway_plans")
      .select("*")
      .eq("id", data.planId)
      .eq("is_published", true)
      .maybeSingle();
    if (!plan) throw new Error("That plan is not available.");

    const monthlyPrice = Number(plan.price_amount ?? 0);
    if (monthlyPrice <= 0) throw new Error("That plan is free — no payment is needed.");
    const enabled = data.interval === "one_off" ? plan.one_time_enabled : data.interval === "monthly" ? plan.monthly_enabled : plan.yearly_enabled;
    if (!enabled) throw new Error("That payment option is not available for this plan.");
    const discount = data.interval === "yearly" ? Number(plan.yearly_discount_percentage ?? 0) : 0;
    const price = data.interval === "yearly" ? Math.round(monthlyPrice * 12 * (1 - discount / 100) * 100) / 100 : monthlyPrice;

    const { data: account } = await supabaseAdmin
      .from("gateway_payout_accounts")
      .select("*")
      .eq("owner_id", plan.owner_id)
      .eq("owner_kind", plan.owner_kind)
      .maybeSingle();
    if (!account?.stripe_account_id || !account.charges_enabled || !account.payments_active) {
      throw new Error("This workspace is not accepting payments yet.");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("user_id", plan.owner_id)
      .maybeSingle();
    // A student who came through their own workspace door returns to it.
    const back = data.returnPath
      ? `${data.origin}${data.returnPath}`
      : `${data.origin}/g/${profile?.username ?? ""}`;

    const { createDirectCheckoutSession } = await import("./stripeConnect.server");
    const session = await createDirectCheckoutSession({
      stripeAccount: account.stripe_account_id,
       mode: data.interval === "one_off" ? "payment" : "subscription",
      amountMinor: Math.round(price * 100),
      currency: plan.currency ?? "GBP",
      productName: plan.name,
       recurringInterval: data.interval === "yearly" ? "year" : "month",
      successUrl: `${back}?checkout=success`,
      cancelUrl: `${back}?checkout=cancelled`,
      customerEmail: (context.claims as { email?: string } | null)?.email ?? null,
      metadata: {
        mathgpl_plan_id: plan.id,
        mathgpl_owner_id: plan.owner_id,
        mathgpl_owner_kind: plan.owner_kind,
        mathgpl_student_id: context.userId,
         mathgpl_billing_interval: data.interval,
      },
    });

    await supabaseAdmin.from("gateway_payments").insert({
        owner_id: plan.owner_id,
        owner_kind: plan.owner_kind,
        student_id: context.userId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount: price,
        currency: plan.currency ?? "GBP",
        status: "pending",
        billing_mode: data.interval === "one_off" ? "one_off" : "subscription",
        billing_interval: data.interval,
        plan_description: plan.description ?? "",
        granted_items: plan.items ?? [],
        yearly_discount_percentage: discount,
        permanent_access: data.interval === "one_off",
        stripe_account_id: account.stripe_account_id,
      stripe_checkout_session_id: session.id,
    });

    await supabaseAdmin.from("gateway_entitlements").upsert(
      {
        owner_id: plan.owner_id,
        owner_kind: plan.owner_kind,
        student_id: context.userId,
        plan_id: plan.id,
        granted_items: [],
        source: "paid",
        status: "pending_payment",
        stripe_checkout_session_id: session.id,
      },
      { onConflict: "owner_id,owner_kind,student_id" },
    );

    return { url: session.url };
  });
