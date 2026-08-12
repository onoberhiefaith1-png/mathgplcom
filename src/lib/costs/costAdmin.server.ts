/**
 * Platform-owner cost accounting reads. Everything here is derived from
 * metered usage events and the admin price book — never entered by hand and
 * never estimated when authoritative figures exist.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { COST_CATEGORIES, type CostCategory } from "./categories";

type Client = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function assertPlatformAdmin(supabase: Client, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("platform_owner") && !roles.includes("co_admin")) {
    throw new Error("Platform administrators only.");
  }
}

const zeroRow = () =>
  Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;

export type CostSeriesPoint = {
  day: string;
  actualCost: Record<CostCategory, number>;
  totalActual: number;
  totalCharge: number;
  totalProfit: number;
};

export type CostOverview = {
  currency: string;
  profitPercentage: number;
  series: CostSeriesPoint[];
  byCategory: { category: CostCategory; actualCost: number; charge: number; profit: number; quantity: number }[];
  totals: { actual: number; charge: number; profit: number; margin: number };
  lockedSubscriptions: { rate: number; count: number }[];
  costUnits: number;
};

export async function costOverview(from: string, to: string): Promise<CostOverview> {
  const db = await admin();

  const [{ data: settings }, { data: rows }, { data: subs }, { count: units }] = await Promise.all([
    db.from("platform_cost_settings").select("profit_percentage, currency").eq("id", 1).maybeSingle(),
    db
      .from("cost_unit_totals")
      .select("day, category, quantity, actual_cost, customer_charge, profit")
      .gte("day", from.slice(0, 10))
      .lte("day", to.slice(0, 10)),
    db.from("subscriptions").select("locked_profit_rate").eq("status", "active").neq("plan", "free"),
    db.from("cost_units").select("id", { count: "exact", head: true }),
  ]);

  const byDay = new Map<string, CostSeriesPoint>();
  const byCategory = new Map<CostCategory, { actualCost: number; charge: number; profit: number; quantity: number }>();

  for (const row of rows ?? []) {
    const day = String(row.day);
    const category = row.category as CostCategory;
    const point =
      byDay.get(day) ??
      { day, actualCost: zeroRow(), totalActual: 0, totalCharge: 0, totalProfit: 0 };
    point.actualCost[category] += Number(row.actual_cost ?? 0);
    point.totalActual += Number(row.actual_cost ?? 0);
    point.totalCharge += Number(row.customer_charge ?? 0);
    point.totalProfit += Number(row.profit ?? 0);
    byDay.set(day, point);

    const agg = byCategory.get(category) ?? { actualCost: 0, charge: 0, profit: 0, quantity: 0 };
    agg.actualCost += Number(row.actual_cost ?? 0);
    agg.charge += Number(row.customer_charge ?? 0);
    agg.profit += Number(row.profit ?? 0);
    agg.quantity += Number(row.quantity ?? 0);
    byCategory.set(category, agg);
  }

  const series = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const actual = series.reduce((s, p) => s + p.totalActual, 0);
  const charge = series.reduce((s, p) => s + p.totalCharge, 0);
  const profit = series.reduce((s, p) => s + p.totalProfit, 0);

  const locked = new Map<number, number>();
  for (const s of subs ?? []) {
    const rate = Number(s.locked_profit_rate ?? 0);
    locked.set(rate, (locked.get(rate) ?? 0) + 1);
  }

  return {
    currency: settings?.currency ?? "GBP",
    profitPercentage: Number(settings?.profit_percentage ?? 0),
    series,
    byCategory: COST_CATEGORIES.map((category) => ({
      category,
      actualCost: byCategory.get(category)?.actualCost ?? 0,
      charge: byCategory.get(category)?.charge ?? 0,
      profit: byCategory.get(category)?.profit ?? 0,
      quantity: byCategory.get(category)?.quantity ?? 0,
    })),
    totals: { actual, charge, profit, margin: charge > 0 ? (profit / charge) * 100 : 0 },
    lockedSubscriptions: [...locked.entries()].map(([rate, count]) => ({ rate, count })),
    costUnits: units ?? 0,
  };
}

export type OwnerRow = {
  costUnitId: string;
  code: string;
  kind: "user" | "workspace";
  name: string;
  email: string;
  accountType: string;
  plan: string;
  lockedRate: number | null;
  categories: Record<CostCategory, number>;
  actual: number;
  charge: number;
  profit: number;
};

async function ownerIndex() {
  const db = await admin();
  const [{ data: units }, { data: profiles }, { data: orgs }, { data: roles }] = await Promise.all([
    db.from("cost_units").select("id, code, owner_kind, user_id, org_id"),
    db.from("profiles").select("user_id, display_name, username, mathgpl_student_id"),
    db.from("organizations").select("id, name, kind"),
    db.from("user_roles").select("user_id, role"),
  ]);

  const profileOf = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const orgOf = new Map((orgs ?? []).map((o) => [o.id as string, o]));
  const roleOf = new Map<string, string>();
  for (const r of roles ?? []) if (!roleOf.has(r.user_id as string)) roleOf.set(r.user_id as string, r.role as string);

  return { units: units ?? [], profileOf, orgOf, roleOf };
}

export async function profitReport(from: string, to: string, query = ""): Promise<OwnerRow[]> {
  const db = await admin();
  const { units, profileOf, orgOf, roleOf } = await ownerIndex();

  const { data: totals } = await db
    .from("cost_unit_totals")
    .select("cost_unit_id, category, actual_cost, customer_charge, profit")
    .gte("day", from.slice(0, 10))
    .lte("day", to.slice(0, 10));

  const { data: subs } = await db
    .from("subscriptions")
    .select("cost_unit_id, plan, status, locked_profit_rate, period_start")
    .order("period_start", { ascending: false });

  const subOf = new Map<string, { plan: string; rate: number | null }>();
  for (const s of subs ?? []) {
    const id = s.cost_unit_id as string;
    if (subOf.has(id)) continue;
    subOf.set(id, {
      plan: (s.plan as string) ?? "free",
      rate: s.status === "active" && s.plan !== "free" ? Number(s.locked_profit_rate ?? 0) : null,
    });
  }

  const agg = new Map<string, { categories: Record<CostCategory, number>; actual: number; charge: number; profit: number }>();
  for (const row of totals ?? []) {
    const id = row.cost_unit_id as string;
    const entry = agg.get(id) ?? { categories: zeroRow(), actual: 0, charge: 0, profit: 0 };
    entry.categories[row.category as CostCategory] += Number(row.actual_cost ?? 0);
    entry.actual += Number(row.actual_cost ?? 0);
    entry.charge += Number(row.customer_charge ?? 0);
    entry.profit += Number(row.profit ?? 0);
    agg.set(id, entry);
  }

  const q = query.trim().toLowerCase();
  const rows: OwnerRow[] = [];

  for (const unit of units) {
    const kind = unit.owner_kind as "user" | "workspace";
    const profile = unit.user_id ? profileOf.get(unit.user_id as string) : undefined;
    const org = unit.org_id ? orgOf.get(unit.org_id as string) : undefined;
    const name =
      kind === "user"
        ? (profile?.display_name as string) || (profile?.username as string) || "MathGPL account"
        : (org?.name as string) || "Workspace";
    const accountType =
      kind === "user" ? roleOf.get(unit.user_id as string) ?? "unknown" : `${org?.kind ?? "workspace"} workspace`;
    const mathgplId = (profile?.mathgpl_student_id as string) ?? "";
    const sub = subOf.get(unit.id as string);
    const stats = agg.get(unit.id as string);

    if (q) {
      const haystack = [name, unit.code, accountType, mathgplId, unit.user_id, unit.org_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    rows.push({
      costUnitId: unit.id as string,
      code: unit.code as string,
      kind,
      name,
      email: "",
      accountType,
      plan: sub?.plan ?? "free",
      lockedRate: sub?.rate ?? null,
      categories: stats?.categories ?? zeroRow(),
      actual: stats?.actual ?? 0,
      charge: stats?.charge ?? 0,
      profit: stats?.profit ?? 0,
    });
  }

  rows.sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name));
  return rows.slice(0, 200);
}

export type CostUnitDetail = {
  row: OwnerRow;
  events: {
    id: string;
    occurredAt: string;
    category: CostCategory;
    metric: string;
    quantity: number;
    unit: string;
    actualCost: number;
    charge: number;
    profit: number;
    feature: string | null;
    model: string | null;
  }[];
  subscriptions: {
    id: string;
    plan: string;
    planId: string | null;
    status: string;
    /** Percentage Profit locked when this period started. */
    lockedRate: number;
    periodStart: string;
    periodEnd: string | null;
    currency: string;
    creditPrice: number;
    discountPercentage: number;
    finalPrice: number;
  }[];

};

export async function costUnitDetail(costUnitId: string, from: string, to: string): Promise<CostUnitDetail | null> {
  const db = await admin();
  const rows = await profitReport(from, to, "");
  let row = rows.find((r) => r.costUnitId === costUnitId);

  if (!row) {
    const all = await profitReport("1970-01-01", to, "");
    row = all.find((r) => r.costUnitId === costUnitId);
  }
  if (!row) return null;

  // Email is only resolved for the single account being inspected.
  const { data: unit } = await db.from("cost_units").select("user_id").eq("id", costUnitId).maybeSingle();
  if (unit?.user_id) {
    const { data: authUser } = await db.auth.admin.getUserById(unit.user_id as string);
    row = { ...row, email: authUser?.user?.email ?? "" };
  }

  const [{ data: events }, { data: subscriptions }] = await Promise.all([
    db
      .from("usage_events")
      .select("id, occurred_at, category, metric, quantity, unit, actual_cost, customer_charge, profit, feature, model")
      .eq("cost_unit_id", costUnitId)
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .limit(100),
    db
      .from("subscriptions")
      .select(
        "id, plan, plan_id, status, locked_profit_rate, period_start, period_end, currency, credit_price, discount_percentage, final_price",
      )
      .eq("cost_unit_id", costUnitId)
      .order("period_start", { ascending: false }),
  ]);

  return {
    row,
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      occurredAt: e.occurred_at as string,
      category: e.category as CostCategory,
      metric: e.metric as string,
      quantity: Number(e.quantity ?? 0),
      unit: (e.unit as string) ?? "unit",
      actualCost: Number(e.actual_cost ?? 0),
      charge: Number(e.customer_charge ?? 0),
      profit: Number(e.profit ?? 0),
      feature: (e.feature as string) ?? null,
      model: (e.model as string) ?? null,
    })),
    subscriptions: (subscriptions ?? []).map((s) => ({
      id: s.id as string,
      plan: s.plan as string,
      planId: (s.plan_id as string) ?? null,
      status: s.status as string,
      /** Percentage Profit locked when this period started. */
      lockedRate: Number(s.locked_profit_rate ?? 0),
      periodStart: s.period_start as string,
      periodEnd: (s.period_end as string) ?? null,
      currency: (s.currency as string) ?? "GBP",
      creditPrice: Number(s.credit_price ?? 0),
      discountPercentage: Number(s.discount_percentage ?? 0),
      finalPrice: Number(s.final_price ?? 0),
    })),
  };
}


export type PriceRow = {
  id: string;
  category: CostCategory;
  metric: string;
  unit: string;
  unitPrice: number | null;
  currency: string;
  effectiveFrom: string;
  note: string | null;
};

/** Current effective rate per metric. */
export async function priceBook(): Promise<PriceRow[]> {
  const db = await admin();
  const { data } = await db
    .from("resource_prices")
    .select("id, category, metric, unit, unit_price, currency, effective_from, note")
    .order("effective_from", { ascending: false });

  const seen = new Set<string>();
  const rows: PriceRow[] = [];
  for (const p of data ?? []) {
    const metric = p.metric as string;
    if (seen.has(metric)) continue;
    seen.add(metric);
    rows.push({
      id: p.id as string,
      category: p.category as CostCategory,
      metric,
      unit: p.unit as string,
      unitPrice: p.unit_price === null ? null : Number(p.unit_price),
      currency: p.currency as string,
      effectiveFrom: p.effective_from as string,
      note: (p.note as string) ?? null,
    });
  }
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.metric.localeCompare(b.metric));
  return rows;
}

/** A price change is a new version, so historical events keep their old rate. */
export async function setPrice(metric: string, unitPrice: number | null) {
  const db = await admin();
  const { data: existing } = await db
    .from("resource_prices")
    .select("category, metric, unit, note")
    .eq("metric", metric)
    .limit(1)
    .maybeSingle();
  if (!existing) throw new Error("Unknown metric.");

  await db.from("resource_prices").insert({
    category: existing.category,
    metric,
    unit: existing.unit,
    unit_price: unitPrice,
    note: existing.note,
    effective_from: new Date().toISOString(),
  });
  return priceBook();
}

export type PricingVersion = {
  id: string;
  profitPercentage: number;
  effectiveFrom: string;
  note: string | null;
  current: boolean;
};

/**
 * Insert-only history of the global Percentage Profit. Old versions are never
 * edited or deleted, so it stays clear why two customers hold different rates.
 */
export async function pricingHistory(): Promise<PricingVersion[]> {
  const db = await admin();
  const { data } = await db
    .from("pricing_versions")
    .select("id, profit_percentage, effective_from, note")
    .order("effective_from", { ascending: false })
    .limit(200);

  const now = Date.now();
  let currentSeen = false;
  return (data ?? []).map((v) => {
    const effectiveFrom = v.effective_from as string;
    const isCurrent = !currentSeen && new Date(effectiveFrom).getTime() <= now;
    if (isCurrent) currentSeen = true;
    return {
      id: v.id as string,
      profitPercentage: Number(v.profit_percentage ?? 0),
      effectiveFrom,
      note: (v.note as string) ?? null,
      current: isCurrent,
    };
  });
}

/**
 * Changing the percentage records a new version and updates the live setting.
 * Existing subscriptions keep the rate locked on their own row, so nothing
 * historical is repriced — only new subscriptions and renewals read this.
 */
export async function setProfitPercentage(value: number, userId?: string) {
  const db = await admin();
  await db
    .from("platform_cost_settings")
    .update({ profit_percentage: value, updated_at: new Date().toISOString() })
    .eq("id", 1);
  await db.from("pricing_versions").insert({
    profit_percentage: value,
    effective_from: new Date().toISOString(),
    created_by: userId ?? null,
  });
  const { syncCatalogReport } = await import("@/lib/payments/catalogSync.server");
  await syncCatalogReport("sandbox");
  await syncCatalogReport("live");
  return value;
}


export async function reconcile(sinceDays = 90) {
  const db = await admin();
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data, error } = await db.rpc("reconcile_usage_costs", { _since: since });
  if (error) throw error;
  return Number(data ?? 0);
}


export type CurrencyRate = {
  id: string;
  currency: string;
  creditValue: number;
  effectiveFrom: string;
  note: string | null;
  current: boolean;
};

/**
 * Buy rate per currency: what one credit is worth in real money. Insert-only,
 * so a transaction priced at £0.30 keeps that rate when the rate later moves.
 */
export async function currencyRates(): Promise<CurrencyRate[]> {
  const db = await admin();
  const { data } = await db
    .from("currency_rates")
    .select("id, currency, credit_value, effective_from, note")
    .order("effective_from", { ascending: false })
    .limit(300);

  const now = Date.now();
  const currentSeen = new Set<string>();
  return (data ?? []).map((r) => {
    const currency = r.currency as string;
    const effectiveFrom = r.effective_from as string;
    const isCurrent = !currentSeen.has(currency) && new Date(effectiveFrom).getTime() <= now;
    if (isCurrent) currentSeen.add(currency);
    return {
      id: r.id as string,
      currency,
      creditValue: Number(r.credit_value ?? 0),
      effectiveFrom,
      note: (r.note as string) ?? null,
      current: isCurrent,
    };
  });
}

/** A rate change is a new version; historical events keep their own snapshot. */
export async function setCurrencyRate(currency: string, creditValue: number, userId?: string) {
  const db = await admin();
  const code = currency.trim().toUpperCase().slice(0, 6);
  await db.from("currency_rates").insert({
    currency: code,
    credit_value: creditValue,
    effective_from: new Date().toISOString(),
    created_by: userId ?? null,
  });
  if (code === "GBP") {
    await db
      .from("platform_cost_settings")
      .update({ credit_rate: creditValue, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }
  return currencyRates();
}


/* ─────────── Platform credit economy: inventory, pricing engine, plans ─────── */

export type CreditPurchase = {
  id: string;
  credits: number;
  unitCost: number;
  currency: string;
  purchasedAt: string;
  note: string | null;
};

export type CreditInventory = {
  purchases: CreditPurchase[];
  purchased: number;
  consumed: number;
  remaining: number;
  spend: number;
  /** What the consumed credits actually cost, at the rate recorded on each event. */
  consumedCost: number;
  averageUnitCost: number;
};

/**
 * Credits the platform owns. Purchases are entered by the administrator (they
 * are real invoices); consumption is read from metered usage, never typed.
 * Money figures come from the rate stored on each record, never from today's
 * global rate — history is never repriced.
 */
export async function creditInventory(): Promise<CreditInventory> {
  const db = await admin();
  const [{ data: purchases }, { data: totals }, { data: events }] = await Promise.all([
    db
      .from("credit_purchases")
      .select("id, credits, unit_cost, currency, purchased_at, note")
      .order("purchased_at", { ascending: false })
      .limit(200),
    db.from("cost_unit_totals").select("cost_credits"),
    db.from("usage_events").select("actual_cost").limit(50_000),
  ]);

  const rows: CreditPurchase[] = (purchases ?? []).map((p) => ({
    id: p.id as string,
    credits: Number(p.credits ?? 0),
    unitCost: Number(p.unit_cost ?? 0),
    currency: (p.currency as string) ?? "GBP",
    purchasedAt: p.purchased_at as string,
    note: (p.note as string) ?? null,
  }));

  const purchased = rows.reduce((s, r) => s + r.credits, 0);
  const spend = rows.reduce((s, r) => s + r.credits * r.unitCost, 0);
  const consumed = (totals ?? []).reduce((s, t) => s + Number(t.cost_credits ?? 0), 0);
  const consumedCost = (events ?? []).reduce((s, e) => s + Number(e.actual_cost ?? 0), 0);

  return {
    purchases: rows,
    purchased,
    consumed,
    remaining: purchased - consumed,
    spend,
    consumedCost,
    averageUnitCost: purchased > 0 ? spend / purchased : 0,
  };
}

export type LockedRatePeriod = {
  costPrice: number;
  profitPercentage: number;
  sellPrice: number;
  credits: number;
  recordedCost: number;
  firstAt: string;
  lastAt: string;
  events: number;
};

/**
 * The rate periods that usage was actually recorded under. Each row is grouped
 * by the cost/profit snapshot stored on the events themselves, so changing the
 * current economics can never move a figure here.
 */
export async function lockedRatePeriods(): Promise<LockedRatePeriod[]> {
  const db = await admin();
  const { data } = await db
    .from("usage_events")
    .select("occurred_at, cost_credits, actual_cost, credit_price, profit_rate")
    .order("occurred_at", { ascending: true })
    .limit(50_000);

  const map = new Map<string, LockedRatePeriod>();
  for (const e of data ?? []) {
    const costPrice = Number(e.credit_price ?? 0);
    const profitPercentage = Number(e.profit_rate ?? 0);
    const key = `${costPrice}|${profitPercentage}`;
    const at = e.occurred_at as string;
    const current =
      map.get(key) ??
      ({
        costPrice,
        profitPercentage,
        sellPrice: costPrice * (1 + profitPercentage / 100),
        credits: 0,
        recordedCost: 0,
        firstAt: at,
        lastAt: at,
        events: 0,
      } satisfies LockedRatePeriod);

    current.credits += Number(e.cost_credits ?? 0);
    current.recordedCost += Number(e.actual_cost ?? 0);
    current.events += 1;
    if (at < current.firstAt) current.firstAt = at;
    if (at > current.lastAt) current.lastAt = at;
    map.set(key, current);
  }

  return [...map.values()].sort((a, b) => (a.firstAt < b.firstAt ? 1 : -1));
}


export async function addCreditPurchase(input: {
  credits: number;
  unitCost: number;
  currency?: string;
  note?: string;
  userId?: string;
}) {
  const db = await admin();
  await db.from("credit_purchases").insert({
    credits: input.credits,
    unit_cost: input.unitCost,
    currency: (input.currency ?? "GBP").toUpperCase().slice(0, 6),
    note: input.note ?? null,
    created_by: input.userId ?? null,
  });
  return creditInventory();
}

export type PricingResolution = {
  currency: string;
  costPrice: number;
  profitPercentage: number;
  sellPrice: number;
  followsBase: boolean;
};

/** What the engine resolves right now for a currency. */
export async function resolvePricing(currency = "GBP"): Promise<PricingResolution> {
  const db = await admin();
  const { data, error } = await db.rpc("resolve_credit_pricing", {
    _currency: currency.toUpperCase(),
    _at: new Date().toISOString(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    currency: (row?.currency as string) ?? currency.toUpperCase(),
    costPrice: Number(row?.cost_price ?? 0),
    profitPercentage: Number(row?.profit_percentage ?? 0),
    sellPrice: Number(row?.sell_price ?? 0),
    followsBase: Boolean(row?.follows_base ?? true),
  };
}

export type CurrencyPricing = {
  currency: string;
  creditValue: number;
  profitPercentage: number;
  followsBase: boolean;
  sellPrice: number;
  effectiveFrom: string;
};

/**
 * Current pricing per currency. A currency either follows the GBP percentage
 * automatically or holds its own; either way its rate history is insert-only.
 */
export async function currencyPricing(): Promise<CurrencyPricing[]> {
  const db = await admin();
  const { data } = await db
    .from("currency_rates")
    .select("currency, credit_value, profit_percentage, follows_base, effective_from")
    .order("effective_from", { ascending: false })
    .limit(400);

  const base = await resolvePricing("GBP");
  const seen = new Set<string>();
  const rows: CurrencyPricing[] = [];
  const now = Date.now();

  for (const r of data ?? []) {
    const currency = r.currency as string;
    if (seen.has(currency)) continue;
    if (new Date(r.effective_from as string).getTime() > now) continue;
    seen.add(currency);
    const followsBase = r.follows_base !== false;
    const percentage = followsBase
      ? base.profitPercentage
      : Number(r.profit_percentage ?? base.profitPercentage);
    const creditValue = Number(r.credit_value ?? 0);
    rows.push({
      currency,
      creditValue,
      profitPercentage: percentage,
      followsBase,
      sellPrice: creditValue * (1 + percentage / 100),
      effectiveFrom: r.effective_from as string,
    });
  }

  rows.sort((a, b) => (a.currency === "GBP" ? -1 : b.currency === "GBP" ? 1 : a.currency.localeCompare(b.currency)));
  return rows;
}

/**
 * Saving a currency records a new insert-only version. Turning "controlled by
 * GBP" on makes it follow the base percentage from now on; turning it off
 * freezes it at its own percentage, and later GBP changes never touch it.
 */
export async function setCurrencyPricing(input: {
  currency: string;
  creditValue: number;
  profitPercentage: number | null;
  followsBase: boolean;
  userId?: string;
}) {
  const db = await admin();
  const code = input.currency.trim().toUpperCase().slice(0, 6);
  await db.from("currency_rates").insert({
    currency: code,
    credit_value: input.creditValue,
    profit_percentage: input.followsBase ? null : input.profitPercentage,
    follows_base: input.followsBase,
    effective_from: new Date().toISOString(),
    created_by: input.userId ?? null,
  });
  if (code === "GBP") {
    await db
      .from("platform_cost_settings")
      .update({ credit_rate: input.creditValue, updated_at: new Date().toISOString() })
      .eq("id", 1);
    const { syncCatalogReport } = await import("@/lib/payments/catalogSync.server");
    await syncCatalogReport("sandbox");
    await syncCatalogReport("live");
  }
  return currencyPricing();
}


export type AdminPlan = {
  id: string;
  key: string;
  audience: "teacher" | "school" | "parent";
  label: string;
  subscriptionAmount: number;
  creditAmount: number;
  currency: string;
  status: "available" | "coming_soon";
  sortOrder: number;
  active: boolean;
};

export async function planCatalogue(): Promise<AdminPlan[]> {
  const db = await admin();
  const { data } = await db
    .from("plans")
    .select("id, key, audience, label, subscription_amount, credit_amount, currency, status, sort_order, active")
    .order("audience")
    .order("sort_order");

  return (data ?? []).map((p) => ({
    id: p.id as string,
    key: p.key as string,
    audience: p.audience as AdminPlan["audience"],
    label: p.label as string,
    subscriptionAmount: Number(p.subscription_amount ?? 0),
    creditAmount: Number(p.credit_amount ?? 0),
    currency: (p.currency as string) ?? "GBP",
    status: (p.status as AdminPlan["status"]) ?? "available",
    sortOrder: Number(p.sort_order ?? 0),
    active: p.active !== false,
  }));
}

/** Only the money split is editable; included credits are always derived. */
export async function savePlanAmounts(input: {
  key: string;
  subscriptionAmount: number;
  creditAmount: number;
}) {
  const db = await admin();
  const { error } = await db
    .from("plans")
    .update({
      subscription_amount: input.subscriptionAmount,
      credit_amount: input.creditAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("key", input.key);
  if (error) throw error;
  return planCatalogue();
}

export type StaffCode = {
  id: string;
  code: string;
  label: string | null;
  entitlement: string;
  active: boolean;
  expiresAt: string | null;
  redemptions: number;
};

/**
 * Staff access is not a promotion: it grants entitlement with no checkout at
 * all, while the usage it generates is still metered as real platform cost.
 */
export async function staffCodes(): Promise<StaffCode[]> {
  const db = await admin();
  const [{ data: codes }, { data: redemptions }] = await Promise.all([
    db
      .from("staff_codes")
      .select("id, code, label, entitlement, active, expires_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("staff_redemptions").select("code_id").eq("active", true),
  ]);

  const count = new Map<string, number>();
  for (const r of redemptions ?? []) {
    const id = r.code_id as string;
    count.set(id, (count.get(id) ?? 0) + 1);
  }

  return (codes ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    label: (c.label as string) ?? null,
    entitlement: (c.entitlement as string) ?? "pro",
    active: c.active !== false,
    expiresAt: (c.expires_at as string) ?? null,
    redemptions: count.get(c.id as string) ?? 0,
  }));
}

export async function saveStaffCode(input: {
  code: string;
  label?: string;
  entitlement: string;
  active: boolean;
  userId?: string;
}) {
  const db = await admin();
  const code = input.code.trim().toUpperCase();
  const { data: existing } = await db.from("staff_codes").select("id").eq("code", code).maybeSingle();

  if (existing) {
    await db
      .from("staff_codes")
      .update({ label: input.label ?? null, entitlement: input.entitlement, active: input.active })
      .eq("id", existing.id as string);
  } else {
    await db.from("staff_codes").insert({
      code,
      label: input.label ?? null,
      entitlement: input.entitlement,
      active: input.active,
      created_by: input.userId ?? null,
    });
  }
  return staffCodes();
}
