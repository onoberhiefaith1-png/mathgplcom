import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUDIENCE = z.enum(["teacher", "school", "parent"]);

async function guard(supabase: Parameters<typeof import("@/lib/costs/costAdmin.server").assertPlatformAdmin>[0], userId: string) {
  const { assertPlatformAdmin } = await import("@/lib/costs/costAdmin.server");
  await assertPlatformAdmin(supabase, userId);
}

/* ─────────── customer-facing ─────────── */

/** Live published plans. Public: the pricing page works before sign-in. */
export const fetchPublishedPlans = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ audience: AUDIENCE.optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { publishedPlans } = await import("./plans.server");
    return { plans: await publishedPlans(data.audience) };
  });

/**
 * Pay-as-you-go packs for the public pricing page. Same table and same live
 * credit sell price as the signed-in view — it simply carries no wallet.
 */
export const fetchPublicCreditPacks = createServerFn({ method: "GET" }).handler(async () => {
  const { creditPacks } = await import("@/lib/credits/topups.server");
  return { packs: await creditPacks() };
});

export const fetchMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mySubscription } = await import("./plans.server");
    return { subscription: await mySubscription(context.supabase, context.userId) };
  });

/** Free plans start immediately; paid plans wait for a confirmed payment. */
export const startFreeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planKey: z.string().min(2).max(60) }).parse(data))
  .handler(async ({ context, data }) => {
    const { startFreePlan } = await import("./plans.server");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("active_org_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return startFreePlan({
      userId: context.userId,
      orgId: (profile?.active_org_id as string) ?? null,
      planKey: data.planKey,
    });
  });

export const requestUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planKey: z.string().min(2).max(60) }).parse(data))
  .handler(async ({ context, data }) => {
    const { scheduleUpgrade } = await import("./plans.server");
    return scheduleUpgrade({ userId: context.userId, planKey: data.planKey });
  });

/* ─────────── administrator ─────────── */

export const fetchPlanDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const { planCatalogue, subscriptionOverview } = await import("./plans.server");
    const { resolvePricing, currencyPricing } = await import("@/lib/costs/costAdmin.server");
    const [plans, overview, base, currencies] = await Promise.all([
      planCatalogue(),
      subscriptionOverview(),
      resolvePricing("GBP"),
      currencyPricing(),
    ]);
    return { plans, overview, base, currencies };
  });

export const savePlanDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        planId: z.string().uuid(),
        label: z.string().min(2).max(80),
        description: z.string().max(400).optional(),
        platformAmount: z.number().min(0).max(1_000_000),
        creditAmount: z.number().min(0).max(1_000_000),
        currency: z.string().min(3).max(6).optional(),
        profitPercentage: z.number().min(0).max(10_000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { savePlanDraft } = await import("./plans.server");
    return {
      plans: await savePlanDraft({
        planId: data.planId,
        label: data.label,
        description: data.description ?? "",
        platformAmount: data.platformAmount,
        creditAmount: data.creditAmount,
        currency: data.currency ?? "GBP",
        profitPercentage: data.profitPercentage ?? null,
      }),
    };
  });

export const publishPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { publishPlan } = await import("./plans.server");
    return publishPlan(data.planId);
  });


export const discardPlanDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { discardPlanDraft } = await import("./plans.server");
    return { plans: await discardPlanDraft(data.planId) };
  });

export const savePlanPresentationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        planId: z.string().uuid(),
        status: z.enum(["available", "coming_soon"]),
        visible: z.boolean(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { setPlanPresentation } = await import("./plans.server");
    return { plans: await setPlanPresentation(data) };
  });

export const savePlanFeaturesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ planId: z.string().uuid(), features: z.array(z.string().max(120)).max(20) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { savePlanFeatures } = await import("./plans.server");
    return { plans: await savePlanFeatures(data.planId, data.features) };
  });

/* ─────────── credits, subscription management, catalogue ─────────── */

const ENV = z.enum(["sandbox", "live"]);

/** Pay-as-you-go packs, priced from the live credit sell price. */
export const fetchCreditOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { creditPacks } = await import("@/lib/credits/topups.server");
    const [packs, summary] = await Promise.all([
      creditPacks(),
      context.supabase.rpc("my_credit_summary"),
    ]);
    const row = Array.isArray(summary.data) ? summary.data[0] : summary.data;
    return {
      packs,
      wallet: {
        balance: Number((row as { balance?: number } | null)?.balance ?? 0),
        nextExpiry: ((row as { next_expiry?: string } | null)?.next_expiry ?? null) as string | null,
        expiringCredits: Number((row as { expiring_credits?: number } | null)?.expiring_credits ?? 0),
      },
    };
  });

export const changePaidPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ planKey: z.string().min(2).max(60), environment: ENV }).parse(data))
  .handler(async ({ context, data }) => {
    const { changePlan } = await import("@/lib/payments/subscriptions.server");
    return changePlan({ userId: context.userId, planKey: data.planKey, env: data.environment });
  });

export const cancelPaidPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ environment: ENV }).parse(data))
  .handler(async ({ context, data }) => {
    const { cancelPlan } = await import("@/lib/payments/subscriptions.server");
    return cancelPlan({ userId: context.userId, env: data.environment });
  });

export const openBillingPortalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ environment: ENV }).parse(data))
  .handler(async ({ context, data }) => {
    const { billingPortalUrl } = await import("@/lib/payments/subscriptions.server");
    return billingPortalUrl({ userId: context.userId, env: data.environment });
  });

/** Administrator view of provider amounts against published amounts. */
export const fetchPaymentCatalogStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ environment: ENV.default("sandbox") }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { catalogStatus } = await import("@/lib/payments/catalogSync.server");
    return { rows: await catalogStatus(data.environment) };
  });

export const syncPaymentCatalogFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ environment: ENV.default("sandbox") }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { syncCatalog } = await import("@/lib/payments/catalogSync.server");
    return syncCatalog(data.environment);
  });
