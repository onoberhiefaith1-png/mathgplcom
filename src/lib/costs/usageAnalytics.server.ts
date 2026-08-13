/**
 * Administrator usage + revenue reads.
 *
 * Everything here is derived from the app's own metered `usage_events` — the
 * single source of truth. Nothing is estimated, and the financial snapshot
 * (cost, margin, charge, status) is read exactly as it was stored when the
 * usage happened, so changing the global margin never rewrites history.
 */
import { COST_CATEGORIES, type CostCategory } from "./categories";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const zero = () => Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;

export type UsagePoint = {
  bucket: string;
  cost: Record<CostCategory, number>;
  quantity: Record<CostCategory, number>;
  credits: Record<CostCategory, number>;
  total: number;
  totalCredits: number;
};

export type UsageAnalytics = {
  currency: string;
  granularity: "hour" | "day";
  creditRate: number;
  series: UsagePoint[];
  byCategory: {
    category: CostCategory;
    cost: number;
    charge: number;
    quantity: number;
    credits: number;
    events: number;
  }[];
  totals: { cost: number; charge: number; paid: number; events: number; credits: number };
  aiTotals: { inputTokens: number; outputTokens: number; images: number; audioMinutes: number; cost: number };
};


type EventRow = {
  id: string;
  occurred_at: string;
  cost_unit_id: string;
  actor_user_id: string | null;
  category: string;
  metric: string;
  quantity: number | null;
  unit: string | null;
  actual_cost: number | null;
  customer_charge: number | null;
  profit_rate: number | null;
  amount_paid: number | null;
  financial_result: number | null;
  payment_status: string | null;
  discount_percentage: number | null;
  promo_code: string | null;
  feature: string | null;
  model: string | null;
  resource_label: string | null;
  cost_credits: number | null;
  charge_credits: number | null;
  paid_credits: number | null;
  credit_price: number | null;
};

const EVENT_COLUMNS =
  "id, occurred_at, cost_unit_id, actor_user_id, category, metric, quantity, unit, actual_cost, customer_charge, profit_rate, amount_paid, financial_result, payment_status, discount_percentage, promo_code, feature, model, resource_label, cost_credits, charge_credits, paid_credits, credit_price";


async function readEvents(from: string, to: string, costUnitId?: string, category?: CostCategory, limit = 5000) {
  const db = await admin();
  let q = db
    .from("usage_events")
    .select(EVENT_COLUMNS)
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (costUnitId) q = q.eq("cost_unit_id", costUnitId);
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

const bucketOf = (iso: string, granularity: "hour" | "day") =>
  granularity === "hour" ? `${iso.slice(0, 13)}:00` : iso.slice(0, 10);

/** Every bucket in the window, so a quiet day still holds its place on the axis. */
function allBuckets(from: string, to: string, granularity: "hour" | "day") {
  const step = granularity === "hour" ? 3_600_000 : 86_400_000;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const out: string[] = [];
  for (let t = start; t <= end && out.length < 400; t += step) {
    out.push(bucketOf(new Date(t).toISOString(), granularity));
  }
  const last = bucketOf(new Date(end).toISOString(), granularity);
  if (out[out.length - 1] !== last) out.push(last);
  return [...new Set(out)];
}

/** Price of one platform credit, from the versioned price book. */
async function creditRateOf() {
  const db = await admin();
  const { data } = await db
    .from("resource_prices")
    .select("unit_price")
    .like("metric", "%.credits")
    .not("unit_price", "is", null)
    .order("effective_from", { ascending: false })
    .limit(1);
  const rate = Number(data?.[0]?.unit_price ?? 0);
  return rate > 0 ? rate : 0.3;
}

export async function usageAnalytics(from: string, to: string, costUnitId?: string): Promise<UsageAnalytics> {
  const db = await admin();
  const [{ data: settings }, events, creditRate] = await Promise.all([
    db.from("platform_cost_settings").select("currency").eq("id", 1).maybeSingle(),
    readEvents(from, to, costUnitId),
    creditRateOf(),
  ]);

  const spanHours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  const granularity: "hour" | "day" = spanHours <= 48 ? "hour" : "day";

  const emptyPoint = (bucket: string): UsagePoint => ({
    bucket,
    cost: zero(),
    quantity: zero(),
    credits: zero(),
    total: 0,
    totalCredits: 0,
  });

  const byBucket = new Map<string, UsagePoint>(allBuckets(from, to, granularity).map((b) => [b, emptyPoint(b)]));
  const byCategory = new Map<
    CostCategory,
    { cost: number; charge: number; quantity: number; credits: number; events: number }
  >();
  const ai = { inputTokens: 0, outputTokens: 0, images: 0, audioMinutes: 0, cost: 0 };
  let cost = 0;
  let charge = 0;
  let paid = 0;
  let credits = 0;

  for (const e of events) {
    const category = e.category as CostCategory;
    const c = Number(e.actual_cost ?? 0);
    // Credit-metered platform usage carries credits directly; priced metrics are
    // converted at the credit rate so the whole chart reads in one unit.
    const eventCredits = e.metric?.endsWith(".credits") ? Number(e.quantity ?? 0) : c / creditRate;
    const bucket = bucketOf(e.occurred_at, granularity);
    const point = byBucket.get(bucket) ?? emptyPoint(bucket);
    point.cost[category] += c;
    point.quantity[category] += Number(e.quantity ?? 0);
    point.credits[category] += eventCredits;
    point.total += c;
    point.totalCredits += eventCredits;
    byBucket.set(bucket, point);

    const agg = byCategory.get(category) ?? { cost: 0, charge: 0, quantity: 0, credits: 0, events: 0 };
    agg.cost += c;
    agg.charge += Number(e.customer_charge ?? 0);
    agg.quantity += Number(e.quantity ?? 0);
    agg.credits += eventCredits;
    agg.events += 1;
    byCategory.set(category, agg);

    cost += c;
    charge += Number(e.customer_charge ?? 0);
    paid += Number(e.amount_paid ?? 0);
    credits += eventCredits;

    if (category === "ai") {
      ai.cost += c;
      const qty = Number(e.quantity ?? 0);
      if (e.metric === "ai.input_tokens") ai.inputTokens += qty * 1_000_000;
      if (e.metric === "ai.output_tokens") ai.outputTokens += qty * 1_000_000;
      if (e.metric === "ai.images") ai.images += qty;
      if (e.metric === "ai.audio_minutes") ai.audioMinutes += qty;
    }
  }

  return {
    currency: settings?.currency ?? "GBP",
    granularity,
    creditRate,
    series: [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    byCategory: COST_CATEGORIES.map((category) => ({
      category,
      cost: byCategory.get(category)?.cost ?? 0,
      charge: byCategory.get(category)?.charge ?? 0,
      quantity: byCategory.get(category)?.quantity ?? 0,
      credits: byCategory.get(category)?.credits ?? 0,
      events: byCategory.get(category)?.events ?? 0,
    })),
    totals: { cost, charge, paid, events: events.length, credits },
    aiTotals: ai,
  };
}


/** What kind of financial event a ledger row is. */
export type LedgerKind = "usage" | "subscription" | "credit_purchase";

export type LedgerRow = {
  id: string;
  kind: LedgerKind;
  occurredAt: string;
  costUnitId: string;
  owner: string;
  ownerCode: string;
  category: CostCategory | "payment";
  metric: string;
  resource: string;
  quantity: number;
  unit: string;
  model: string | null;
  cost: number;
  charge: number;
  /** Percentage Profit locked to the subscription that priced this event. */
  profitRate: number;
  profitAmount: number;
  /** Credits — the accounting unit. Money below is only the equivalent. */
  costCredits: number;
  chargeCredits: number;
  profitCredits: number;
  paidCredits: number;
  resultCredits: number;
  creditPrice: number;
  amountPaid: number;
  discount: number;
  promoCode: string | null;
  /** Money collected on a payment row; prepaid value, never usage revenue. */
  cashReceived: number;
  /** Credits issued by a payment row — a liability until they are consumed. */
  creditsIssued: number;
  /** The subscription (service) component of a payment. */
  serviceAmount: number;
  reference: string | null;

  status: string;
  result: number;
};

async function ownerNames(costUnitIds: string[]) {
  const db = await admin();
  const ids = [...new Set(costUnitIds)];
  if (ids.length === 0) return new Map<string, { name: string; code: string }>();

  const { data: units } = await db.from("cost_units").select("id, code, owner_kind, user_id, org_id").in("id", ids);
  const userIds = (units ?? []).map((u) => u.user_id as string).filter(Boolean);
  const orgIds = (units ?? []).map((u) => u.org_id as string).filter(Boolean);

  const [{ data: profiles }, { data: orgs }] = await Promise.all([
    userIds.length
      ? db.from("profiles").select("user_id, display_name, username").in("user_id", userIds)
      : Promise.resolve({ data: [] as never[] }),
    orgIds.length ? db.from("organizations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] as never[] }),
  ]);

  const profileOf = new Map((profiles ?? []).map((p: any) => [p.user_id as string, p]));
  const orgOf = new Map((orgs ?? []).map((o: any) => [o.id as string, o]));

  return new Map(
    (units ?? []).map((u) => {
      const profile = u.user_id ? profileOf.get(u.user_id as string) : undefined;
      const org = u.org_id ? orgOf.get(u.org_id as string) : undefined;
      const name =
        u.owner_kind === "workspace"
          ? (org?.name as string) || "Workspace"
          : (profile?.display_name as string) || (profile?.username as string) || "MathGPL account";
      return [u.id as string, { name, code: (u.code as string) ?? "" }];
    }),
  );
}

const RESOURCE_LABEL: Record<string, string> = {
  "ai.input_tokens": "AI input tokens",
  "ai.output_tokens": "AI output tokens",
  "ai.images": "AI images",
  "ai.audio_minutes": "AI audio",
  "compute.invocations": "Function calls",
  "compute.gb_seconds": "Compute time",
  "storage.gb_month": "Stored files",
  "network.egress_gb": "Network transfer",
  "realtime.minutes": "Realtime minutes",
  "realtime.messages": "Realtime messages",
  "database.rows_written": "Database writes",
  "database.gb_month": "Database size",
  "database.credits": "Platform database usage",
  "network.credits": "Platform network usage",
  "storage.credits": "Platform storage usage",
  "compute.credits": "Platform compute usage",
  "realtime.credits": "Platform realtime usage",
  "ai.credits": "Platform AI usage",
};


function toLedgerRow(e: EventRow, owners: Map<string, { name: string; code: string }>): LedgerRow {
  const owner = owners.get(e.cost_unit_id);
  const cost = Number(e.actual_cost ?? 0);
  const charge = Number(e.customer_charge ?? 0);
  const creditPrice = Number(e.credit_price ?? 0) || 0.3;
  const costCredits = Number(e.cost_credits ?? 0) || (creditPrice > 0 ? cost / creditPrice : 0);
  const chargeCredits = Number(e.charge_credits ?? 0) || costCredits * (1 + Number(e.profit_rate ?? 0) / 100);
  const paidCredits = Number(e.paid_credits ?? 0);
  return {
    id: e.id,
    kind: "usage",
    cashReceived: 0,
    creditsIssued: 0,
    serviceAmount: 0,
    reference: null,
    occurredAt: e.occurred_at,
    costUnitId: e.cost_unit_id,
    owner: owner?.name ?? "Unknown account",
    ownerCode: owner?.code ?? "",
    category: e.category as CostCategory,
    metric: e.metric,
    resource: e.resource_label || e.feature || RESOURCE_LABEL[e.metric] || e.metric,
    quantity: Number(e.quantity ?? 0),
    unit: e.unit ?? "unit",
    model: e.model,
    cost,
    charge,
    profitRate: Number(e.profit_rate ?? 0),
    profitAmount: charge - cost,
    costCredits,
    chargeCredits,
    profitCredits: chargeCredits - costCredits,
    paidCredits,
    // Credits actually collected minus credits consumed: unpaid usage is a loss
    // of what was consumed, never a claim on expected revenue.
    resultCredits: paidCredits - costCredits,
    creditPrice,

    amountPaid: Number(e.amount_paid ?? 0),
    discount: Number(e.discount_percentage ?? 0),
    promoCode: e.promo_code,
    status: e.payment_status ?? "free",
    result: Number(e.financial_result ?? 0),
  };
}

export async function categoryEvents(
  from: string,
  to: string,
  category: CostCategory,
  costUnitId?: string,
): Promise<LedgerRow[]> {
  const events = await readEvents(from, to, costUnitId, category, 500);
  const owners = await ownerNames(events.map((e) => e.cost_unit_id));
  return events.map((e) => toLedgerRow(e, owners));
}

export type RevenueLedger = {
  currency: string;
  rows: LedgerRow[];
  summary: {
    cost: number;
    charge: number;
    paid: number;
    expectedProfit: number;
    result: number;
    unpaidExposure: number;
    freeSubsidy: number;
    creditPrice: number;
    costCredits: number;
    chargeCredits: number;
    paidCredits: number;
    expectedProfitCredits: number;
    resultCredits: number;
    unpaidExposureCredits: number;
    byStatus: { status: string; events: number; charge: number; paid: number; result: number }[];
  };
};

export async function revenueLedger(
  from: string,
  to: string,
  options: { costUnitId?: string; status?: string; query?: string } = {},
): Promise<RevenueLedger> {
  const db = await admin();
  const [{ data: settings }, events] = await Promise.all([
    db.from("platform_cost_settings").select("currency").eq("id", 1).maybeSingle(),
    readEvents(from, to, options.costUnitId, undefined, 4000),
  ]);

  const owners = await ownerNames(events.map((e) => e.cost_unit_id));
  let rows = events.map((e) => toLedgerRow(e, owners));

  if (options.status && options.status !== "all") rows = rows.filter((r) => r.status === options.status);
  const q = (options.query ?? "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) =>
      [r.owner, r.ownerCode, r.resource, r.metric, r.model ?? "", r.status].join(" ").toLowerCase().includes(q),
    );
  }

  const byStatus = new Map<string, { status: string; events: number; charge: number; paid: number; result: number }>();
  const summary = {
    cost: 0,
    charge: 0,
    paid: 0,
    expectedProfit: 0,
    result: 0,
    unpaidExposure: 0,
    freeSubsidy: 0,
    creditPrice: 0.3,
    costCredits: 0,
    chargeCredits: 0,
    paidCredits: 0,
    expectedProfitCredits: 0,
    resultCredits: 0,
    unpaidExposureCredits: 0,
  };

  for (const r of rows) {
    summary.cost += r.cost;
    summary.charge += r.charge;
    summary.paid += r.amountPaid;
    summary.expectedProfit += r.profitAmount;

    summary.result += r.result;
    summary.costCredits += r.costCredits;
    summary.chargeCredits += r.chargeCredits;
    summary.paidCredits += r.paidCredits;
    summary.expectedProfitCredits += r.profitCredits;
    summary.resultCredits += r.resultCredits;
    if (r.status === "unpaid") {
      summary.unpaidExposure += r.charge;
      summary.unpaidExposureCredits += r.chargeCredits - r.paidCredits;
    }
    if (r.status === "free") summary.freeSubsidy += r.cost;
    if (r.creditPrice > 0) summary.creditPrice = r.creditPrice;

    const agg = byStatus.get(r.status) ?? { status: r.status, events: 0, charge: 0, paid: 0, result: 0 };
    agg.events += 1;
    agg.charge += r.charge;
    agg.paid += r.amountPaid;
    agg.result += r.result;
    byStatus.set(r.status, agg);
  }

  return {
    currency: settings?.currency ?? "GBP",
    rows: rows.slice(0, 400),
    summary: { ...summary, byStatus: [...byStatus.values()].sort((a, b) => b.events - a.events) },
  };
}

export type AccountOption = {
  costUnitId: string;
  code: string;
  name: string;
  kind: "user" | "workspace";
  accountType: string;
  balance: number;
  cost: number;
  charge: number;
};

/** Accounts for the "All usage | Users" switch, ordered by spend. */
export async function accountOptions(from: string, to: string, query = ""): Promise<AccountOption[]> {
  const db = await admin();
  const [{ data: units }, { data: profiles }, { data: orgs }, { data: roles }, { data: wallets }, { data: totals }] =
    await Promise.all([
      db.from("cost_units").select("id, code, owner_kind, user_id, org_id"),
      db.from("profiles").select("user_id, display_name, username, mathgpl_student_id"),
      db.from("organizations").select("id, name, kind"),
      db.from("user_roles").select("user_id, role"),
      db.from("credit_wallets").select("cost_unit_id, balance"),
      db
        .from("cost_unit_totals")
        .select("cost_unit_id, actual_cost, customer_charge")
        .gte("day", from.slice(0, 10))
        .lte("day", to.slice(0, 10)),
    ]);

  const profileOf = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const orgOf = new Map((orgs ?? []).map((o) => [o.id as string, o]));
  const roleOf = new Map<string, string>();
  for (const r of roles ?? []) if (!roleOf.has(r.user_id as string)) roleOf.set(r.user_id as string, r.role as string);
  const balanceOf = new Map((wallets ?? []).map((w) => [w.cost_unit_id as string, Number(w.balance ?? 0)]));

  const spend = new Map<string, { cost: number; charge: number }>();
  for (const t of totals ?? []) {
    const id = t.cost_unit_id as string;
    const agg = spend.get(id) ?? { cost: 0, charge: 0 };
    agg.cost += Number(t.actual_cost ?? 0);
    agg.charge += Number(t.customer_charge ?? 0);
    spend.set(id, agg);
  }

  const q = query.trim().toLowerCase();
  const rows: AccountOption[] = [];

  for (const u of units ?? []) {
    const kind = (u.owner_kind as "user" | "workspace") ?? "user";
    const profile = u.user_id ? profileOf.get(u.user_id as string) : undefined;
    const org = u.org_id ? orgOf.get(u.org_id as string) : undefined;
    const name =
      kind === "workspace"
        ? (org?.name as string) || "Workspace"
        : (profile?.display_name as string) || (profile?.username as string) || "MathGPL account";
    const accountType =
      kind === "workspace" ? `${org?.kind ?? "workspace"} workspace` : roleOf.get(u.user_id as string) ?? "account";
    const mathgplId = (profile?.mathgpl_student_id as string) ?? "";

    if (q && ![name, u.code, accountType, mathgplId].filter(Boolean).join(" ").toLowerCase().includes(q)) continue;

    const stats = spend.get(u.id as string);
    rows.push({
      costUnitId: u.id as string,
      code: (u.code as string) ?? "",
      name,
      kind,
      accountType,
      balance: balanceOf.get(u.id as string) ?? 0,
      cost: stats?.cost ?? 0,
      charge: stats?.charge ?? 0,
    });
  }

  rows.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
  return rows.slice(0, 250);
}

export async function grantCredits(costUnitId: string, amount: number, note: string) {
  const db = await admin();
  const { data, error } = await db.rpc("adjust_credits", {
    _cost_unit_id: costUnitId,
    _amount: amount,
    _kind: amount >= 0 ? "grant" : "adjustment",
    _note: note,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export type PromoRow = {
  id: string;
  code: string;
  kind: string;
  discountPercentage: number;
  label: string | null;
  active: boolean;
  expiresAt: string | null;
  redemptions: number;
};

export async function promoCodes(): Promise<PromoRow[]> {
  const db = await admin();
  const [{ data: codes }, { data: redemptions }] = await Promise.all([
    db.from("promo_codes").select("id, code, kind, discount_percentage, label, active, expires_at").order("code"),
    db.from("promo_redemptions").select("code_id").eq("active", true),
  ]);
  const count = new Map<string, number>();
  for (const r of redemptions ?? []) count.set(r.code_id as string, (count.get(r.code_id as string) ?? 0) + 1);
  return (codes ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    kind: c.kind as string,
    discountPercentage: Number(c.discount_percentage ?? 0),
    label: (c.label as string) ?? null,
    active: Boolean(c.active),
    expiresAt: (c.expires_at as string) ?? null,
    redemptions: count.get(c.id as string) ?? 0,
  }));
}

export async function savePromoCode(input: {
  code: string;
  kind: string;
  discountPercentage: number;
  label?: string;
  active: boolean;
}) {
  const db = await admin();
  const { error } = await db.from("promo_codes").upsert(
    {
      code: input.code.trim().toUpperCase(),
      kind: input.kind,
      discount_percentage: input.kind === "staff" ? 100 : input.discountPercentage,
      label: input.label ?? null,
      active: input.active,
    },
    { onConflict: "code" },
  );
  if (error) throw error;
  return promoCodes();
}
