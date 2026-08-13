/**
 * The plan engine.
 *
 * A plan's money split (platform amount + credit budget) is what the
 * administrator edits. Included credits are always *derived* from the live
 * credit sell price, never typed. Edits live in a draft until they are
 * published as a new numbered version, and a subscription keeps the version it
 * was created from, so publishing never repricies anybody already subscribed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PlanAudience = "teacher" | "school" | "parent";

/** The yearly discount every paid plan carries. Derived, never typed. */
export const YEARLY_DISCOUNT = 0.2;
const round2 = (n: number) => Math.round(n * 100) / 100;
export const yearlyPriceOf = (monthly: number) => round2(monthly * 12 * (1 - YEARLY_DISCOUNT));
export const standardAnnualPriceOf = (monthly: number) => round2(monthly * 12);

export type PlanVersion = {
  id: string;
  versionNo: number;
  label: string | null;
  description: string | null;
  price: number;
  platformAmount: number;
  creditAmount: number;
  currency: string;
  profitPercentage: number;
  creditCost: number;
  creditSellPrice: number;
  includedCredits: number;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  /** 12 months less the yearly discount. */
  yearlyPrice: number;
  /** 12 months at the monthly price, before the discount. */
  standardAnnualPrice: number;
};

export type PlanRecord = {
  id: string;
  key: string;
  audience: PlanAudience;
  label: string;
  description: string | null;
  currency: string;
  status: "available" | "coming_soon";
  isFree: boolean;
  visible: boolean;
  active: boolean;
  yearlyEnabled: boolean;
  sortOrder: number;
  /**
   * The customer-facing list, generated from the plan's Plan Access switches
   * and limits. There is no separate typed description to drift from it.
   */
  features: string[];
  live: PlanVersion | null;
  draft: PlanVersion | null;
  history: PlanVersion[];
};

const version = (r: Record<string, unknown> | null | undefined): PlanVersion | null => {
  if (!r) return null;
  const price = Number(r["price"] ?? 0);
  return {
    id: String(r["id"]),
    versionNo: Number(r["version_no"] ?? 0),
    label: (r["label"] as string) ?? null,
    description: (r["description"] as string) ?? null,
    price,
    platformAmount: Number(r["platform_amount"] ?? 0),
    creditAmount: Number(r["credit_amount"] ?? 0),
    currency: (r["currency"] as string) ?? "GBP",
    profitPercentage: Number(r["profit_percentage"] ?? 0),
    creditCost: Number(r["credit_cost"] ?? 0),
    creditSellPrice: Number(r["credit_sell_price"] ?? 0),
    includedCredits: Number(r["included_credits"] ?? 0),
    status: (r["status"] as PlanVersion["status"]) ?? "draft",
    publishedAt: (r["published_at"] as string) ?? null,
    yearlyPrice: yearlyPriceOf(price),
    standardAnnualPrice: standardAnnualPriceOf(price),
  };
};

const VERSION_COLUMNS =
  "id, plan_id, version_no, label, description, price, platform_amount, credit_amount, currency, profit_percentage, credit_cost, credit_sell_price, included_credits, status, published_at";

const LIMIT_LINE: Record<string, (v: number | null) => string> = {
  max_classes: (v) => (v === null ? "Unlimited classes" : `${v} ${v === 1 ? "class" : "classes"}`),
  max_students: (v) => (v === null ? "Unlimited students" : `Up to ${v} students per class`),
};

/**
 * What a plan includes, generated from the plan's own access switches and
 * limits. The switches are the single source of truth: whatever the plan
 * actually unlocks is exactly what the customer reads.
 */
async function generatedFeatures(): Promise<Map<string, string[]>> {
  const db = await admin();
  const [{ data: catalogue }, { data: granted }, { data: limits }] = await Promise.all([
    db.from("feature_entitlements").select("key, label, sort_order").order("sort_order"),
    db.from("plan_entitlements").select("plan_id, feature_key"),
    db.from("plan_limits").select("plan_id, limit_key, limit_value"),
  ]);

  const labelOf = new Map((catalogue ?? []).map((f) => [String(f.key), String(f.label)]));
  const keysInOrder = (catalogue ?? []).map((f) => String(f.key));

  const keysByPlan = new Map<string, Set<string>>();
  for (const row of granted ?? []) {
    const planId = String(row.plan_id);
    const set = keysByPlan.get(planId) ?? new Set<string>();
    set.add(String(row.feature_key));
    keysByPlan.set(planId, set);
  }

  const out = new Map<string, string[]>();
  for (const [planId, set] of keysByPlan) {
    out.set(
      planId,
      keysInOrder.filter((k) => set.has(k)).map((k) => labelOf.get(k)!),
    );
  }

  for (const row of limits ?? []) {
    const line = LIMIT_LINE[String(row.limit_key)];
    if (!line) continue;
    const planId = String(row.plan_id);
    const value = row.limit_value === null || row.limit_value === undefined ? null : Number(row.limit_value);
    out.set(planId, [...(out.get(planId) ?? []), line(value)]);
  }
  return out;
}

/** Full catalogue with drafts and history — administrator view. */
export async function planCatalogue(): Promise<PlanRecord[]> {
  const db = await admin();
  const [{ data: plans }, { data: versions }, features] = await Promise.all([
    db
      .from("plans")
      .select(
        "id, key, audience, label, description, currency, status, is_free, audience_visible, active, yearly_enabled, sort_order",
      )
      .order("audience")
      .order("sort_order"),
    db.from("plan_versions").select(VERSION_COLUMNS).order("version_no", { ascending: false }),
    generatedFeatures(),
  ]);

  const byPlan = new Map<string, PlanVersion[]>();
  for (const row of versions ?? []) {
    const list = byPlan.get(String(row.plan_id)) ?? [];
    const v = version(row as Record<string, unknown>);
    if (v) list.push(v);
    byPlan.set(String(row.plan_id), list);
  }

  return (plans ?? []).map((p) => {
    const list = byPlan.get(String(p.id)) ?? [];
    return {
      id: String(p.id),
      key: String(p.key),
      audience: p.audience as PlanAudience,
      label: String(p.label),
      description: (p.description as string) ?? null,
      currency: (p.currency as string) ?? "GBP",
      status: (p.status as PlanRecord["status"]) ?? "available",
      isFree: p.is_free === true,
      visible: p.audience_visible !== false,
      active: p.active !== false,
      yearlyEnabled: (p as { yearly_enabled?: boolean }).yearly_enabled !== false,
      sortOrder: Number(p.sort_order ?? 0),
      features: features.get(String(p.id)) ?? [],
      live: list.find((v) => v.status === "published") ?? null,
      draft: list.find((v) => v.status === "draft") ?? null,
      history: list.filter((v) => v.status !== "draft"),
    };
  });
}

/** What a customer is allowed to see: live published versions only. */
export async function publishedPlans(audience?: PlanAudience) {
  const all = await planCatalogue();
  return all
    .filter((p) => p.active && p.visible && (!audience || p.audience === audience))
    .map((p) => {
      const price = p.live?.price ?? 0;
      return {
        key: p.key,
        audience: p.audience,
        label: p.live?.label ?? p.label,
        description: p.live?.description ?? p.description,
        status: p.status,
        isFree: price === 0,
        features: p.features,
        price,
        platformAmount: p.live?.platformAmount ?? 0,
        creditAmount: p.live?.creditAmount ?? 0,
        currency: p.live?.currency ?? p.currency,
        includedCredits: p.live?.includedCredits ?? 0,
        creditSellPrice: p.live?.creditSellPrice ?? 0,
        versionNo: p.live?.versionNo ?? 0,
        /** Yearly is offered whenever the plan is paid and yearly is enabled. */
        yearlyAvailable: price > 0 && p.yearlyEnabled,
        yearlyPrice: yearlyPriceOf(price),
        standardAnnualPrice: standardAnnualPriceOf(price),
        yearlyDiscountPercentage: Math.round(YEARLY_DISCOUNT * 100),
      };
    });
}

export type PublicPlan = Awaited<ReturnType<typeof publishedPlans>>[number];

/** Save the administrator's pending edit. Nothing customer-facing moves yet. */
export async function savePlanDraft(input: {
  planId: string;
  label: string;
  description: string;
  platformAmount: number;
  creditAmount: number;
  currency: string;
  profitPercentage: number | null;
}) {
  const db = await admin();
  const { error } = await db.rpc("save_plan_draft", {
    _plan_id: input.planId,
    _label: input.label,
    _description: input.description,
    _platform_amount: input.platformAmount,
    _credit_amount: input.creditAmount,
    _currency: input.currency.toUpperCase(),
    _profit_percentage: input.profitPercentage ?? undefined,
  });
  if (error) throw new Error(error.message);
  return planCatalogue();
}

export async function discardPlanDraft(planId: string) {
  const db = await admin();
  await db.from("plan_versions").delete().eq("plan_id", planId).eq("status", "draft");
  return planCatalogue();
}

/**
 * Publishing mints the next version number; older versions are kept, and the
 * new amount is pushed straight to checkout. The push result is returned so
 * the administrator is told when checkout is still charging the old amount.
 */
export async function publishPlan(planId: string) {
  const db = await admin();
  const { error } = await db.rpc("publish_plan_version", { _plan_id: planId });
  if (error) throw new Error(error.message);
  const { syncCatalogReport } = await import("@/lib/payments/catalogSync.server");
  const sync = [await syncCatalogReport("sandbox"), await syncCatalogReport("live")];
  return { plans: await planCatalogue(), sync };
}



export async function setPlanPresentation(input: {
  planId: string;
  status: "available" | "coming_soon";
  visible: boolean;
  active: boolean;
}) {
  const db = await admin();
  const { error } = await db
    .from("plans")
    .update({
      status: input.status,
      audience_visible: input.visible,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.planId);
  if (error) throw new Error(error.message);
  return planCatalogue();
}

/* No hand-written feature list: see generatedFeatures() above. */


/* ─────────── subscriptions ─────────── */

export type MySubscription = {
  planKey: string;
  planLabel: string;
  status: string;
  price: number;
  currency: string;
  includedCredits: number;
  profitPercentage: number;
  versionNo: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  scheduledPlanId: string | null;
  cancelAt: string | null;
  paymentState: "ok" | "past_due";
  /** What the customer bought: a monthly or a yearly period. */
  billingInterval: "monthly" | "yearly";
  /** End of the renewal grace window while the plan is expired. */
  graceUntil: string | null;
};

/**
 * The caller's own subscription, read through their own session (RLS).
 * Expired plans are included: during the renewal grace window the account
 * keeps its workspace, so the dashboard must still be able to show it.
 */
export async function mySubscription(supabase: Client, userId: string): Promise<MySubscription | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "plan, plan_id, status, final_price, currency, included_credits, locked_profit_rate, period_start, period_end, scheduled_plan_id, cancel_at, payment_state, plan_version_id, grace_until, billing_interval",
    )
    .eq("user_id", userId)
    .in("status", ["active", "expired"])
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const db = await admin();
  const [{ data: plan }, { data: v }] = await Promise.all([
    db.from("plans").select("label").eq("key", String(data.plan_id ?? data.plan)).maybeSingle(),
    data.plan_version_id
      ? db.from("plan_versions").select("version_no").eq("id", String(data.plan_version_id)).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    planKey: String(data.plan_id ?? data.plan),
    planLabel: (plan?.label as string) ?? String(data.plan_id ?? data.plan),
    status: String(data.status),
    price: Number(data.final_price ?? 0),
    currency: (data.currency as string) ?? "GBP",
    includedCredits: Number(data.included_credits ?? 0),
    profitPercentage: Number(data.locked_profit_rate ?? 0),
    versionNo: v ? Number((v as { version_no?: number }).version_no ?? 0) : null,
    periodStart: (data.period_start as string) ?? null,
    periodEnd: (data.period_end as string) ?? null,
    scheduledPlanId: (data.scheduled_plan_id as string) ?? null,
    cancelAt: (data.cancel_at as string) ?? null,
    paymentState: (data.payment_state as "ok" | "past_due") ?? "ok",
    billingInterval:
      (data as { billing_interval?: string | null }).billing_interval === "yearly" ? "yearly" : "monthly",
    graceUntil: ((data as { grace_until?: string | null }).grace_until as string) ?? null,
  };
}

/**
 * Starts a free plan. The version in force right now is locked onto the
 * subscription and its included credits land in the member's wallet.
 * Paid plans never come through here — they wait for a confirmed payment.
 */
export async function startFreePlan(input: { userId: string; orgId: string | null; planKey: string }) {
  const db = await admin();
  const { data: plan } = await db
    .from("plans")
    .select("id, key, status, active, current_version_id")
    .eq("key", input.planKey)
    .maybeSingle();
  if (!plan || plan.active === false || plan.status !== "available") throw new Error("That plan is not available.");

  const { data: live } = await db
    .from("plan_versions")
    .select("price")
    .eq("id", String(plan.current_version_id ?? ""))
    .maybeSingle();
  if (Number(live?.price ?? 0) > 0) throw new Error("This plan needs a payment before it can start.");

  const { data, error } = await db.rpc("activate_subscription", {
    _user_id: input.userId,
    _plan_key: input.planKey,
    _org_id: input.orgId ?? undefined,
    _provider: "none",
    _provider_subscription_id: undefined,
    _amount_paid: 0,
    _period_days: 30,
  });
  if (error) throw new Error(error.message);
  return { subscriptionId: String(data ?? "") };
}

/** A pending upgrade is remembered so it can be applied when payment lands. */
export async function scheduleUpgrade(input: { userId: string; planKey: string }) {
  const db = await admin();
  const { error } = await db
    .from("subscriptions")
    .update({ scheduled_plan_id: input.planKey, updated_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return { scheduled: input.planKey };
}

/* ─────────── admin subscription analytics ─────────── */

export async function subscriptionOverview() {
  const db = await admin();
  const [{ data: subs }, { data: payments }] = await Promise.all([
    db
      .from("subscriptions")
      .select("plan_id, plan, status, final_price, currency, included_credits, locked_profit_rate, period_end")
      .order("period_start", { ascending: false })
      .limit(500),
    db
      .from("payment_transactions")
      .select("amount, currency, status, credits_allocated, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  const byPlan = new Map<string, { planKey: string; active: number; revenue: number; credits: number }>();
  for (const s of subs ?? []) {
    const key = String(s.plan_id ?? s.plan ?? "free");
    const agg = byPlan.get(key) ?? { planKey: key, active: 0, revenue: 0, credits: 0 };
    if (s.status === "active") {
      agg.active += 1;
      agg.revenue += Number(s.final_price ?? 0);
      agg.credits += Number(s.included_credits ?? 0);
    }
    byPlan.set(key, agg);
  }

  const collected = (payments ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return {
    byPlan: [...byPlan.values()].sort((a, b) => b.active - a.active),
    activeCount: (subs ?? []).filter((s) => s.status === "active").length,
    monthlyRevenue: [...byPlan.values()].reduce((s, p) => s + p.revenue, 0),
    allocatedCredits: [...byPlan.values()].reduce((s, p) => s + p.credits, 0),
    collected,
    payments: (payments ?? []).slice(0, 40).map((p) => ({
      amount: Number(p.amount ?? 0),
      currency: (p.currency as string) ?? "GBP",
      status: String(p.status),
      credits: Number(p.credits_allocated ?? 0),
      occurredAt: String(p.occurred_at),
    })),
  };
}
