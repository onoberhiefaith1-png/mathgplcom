/**
 * The authoritative financial position for administrators.
 *
 * The one rule this file exists to enforce: a credit purchase is prepaid value,
 * not profit. Cash received, prepaid credits still outstanding, and the revenue
 * realised when those credits are actually consumed are kept strictly apart.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type FinancialSummary = {
  currency: string;
  /** Money actually collected in the window (subscriptions + credit purchases). */
  cashReceived: number;
  /** The service component of subscription payments — recognised immediately. */
  subscriptionRevenue: number;
  /** The credit component of payments — prepaid value, never revenue on receipt. */
  creditCashReceived: number;
  creditsIssued: number;
  refunds: number;
  /** Liability: credits sold and not yet consumed, valued at their sold price. */
  prepaidOutstandingCredits: number;
  prepaidOutstandingValue: number;
  /** Revenue realised by consuming prepaid credits in the window. */
  realisedUsageCredits: number;
  realisedUsageRevenue: number;
  /** What that usage really cost the platform. */
  underlyingCostCredits: number;
  underlyingCost: number;
  realisedProfit: number;
  /** Genuinely unfunded usage only — prepaid consumption never appears here. */
  exposureCredits: number;
  exposure: number;
  netResult: number;
  events: number;
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export async function financialSummary(
  from: string,
  to: string,
  costUnitId?: string,
): Promise<FinancialSummary> {
  const db = await admin();

  let usageQuery = db
    .from("usage_events")
    .select(
      "actual_cost, cost_credits, paid_credits, charge_credits, credit_price, profit_rate, payment_status, credit_lot_id",
    )
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .limit(20_000);
  if (costUnitId) usageQuery = usageQuery.eq("cost_unit_id", costUnitId);

  let paymentsQuery = db
    .from("payment_transactions")
    .select("amount, service_amount, credit_amount, credits_allocated, status, plan_id, currency, user_id, org_id")
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .limit(20_000);

  let lotsQuery = db
    .from("credit_grants")
    .select("id, remaining, sell_price_at_purchase, cost_per_credit_at_purchase, customer_multiplier, cost_unit_id")
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .limit(20_000);
  if (costUnitId) lotsQuery = lotsQuery.eq("cost_unit_id", costUnitId);

  const [{ data: settings }, { data: usage }, { data: payments }, { data: lots }] = await Promise.all([
    db.from("platform_cost_settings").select("currency").eq("id", 1).maybeSingle(),
    usageQuery,
    paymentsQuery,
    lotsQuery,
  ]);

  // Lot sell prices let consumed credits be valued at the price they were sold
  // for, never at today's price.
  const consumedLotIds = [...new Set((usage ?? []).map((u) => u.credit_lot_id as string).filter(Boolean))];
  const sellPriceOf = new Map<string, number>();
  for (const lot of lots ?? []) sellPriceOf.set(lot.id as string, n(lot.sell_price_at_purchase));
  const missing = consumedLotIds.filter((id) => !sellPriceOf.has(id));
  if (missing.length) {
    const { data: spent } = await db
      .from("credit_grants")
      .select("id, sell_price_at_purchase")
      .in("id", missing.slice(0, 1000));
    for (const lot of spent ?? []) sellPriceOf.set(lot.id as string, n(lot.sell_price_at_purchase));
  }

  const summary: FinancialSummary = {
    currency: (settings?.currency as string) ?? "GBP",
    cashReceived: 0,
    subscriptionRevenue: 0,
    creditCashReceived: 0,
    creditsIssued: 0,
    refunds: 0,
    prepaidOutstandingCredits: 0,
    prepaidOutstandingValue: 0,
    realisedUsageCredits: 0,
    realisedUsageRevenue: 0,
    underlyingCostCredits: 0,
    underlyingCost: 0,
    realisedProfit: 0,
    exposureCredits: 0,
    exposure: 0,
    netResult: 0,
    events: (usage ?? []).length,
  };

  for (const p of payments ?? []) {
    const status = String(p.status ?? "");
    const amount = n(p.amount);
    if (status === "refunded" || status === "reversed" || amount < 0) {
      summary.refunds += Math.abs(amount);
      continue;
    }
    if (status !== "succeeded" && status !== "paid" && status !== "free") continue;
    summary.cashReceived += amount;
    summary.subscriptionRevenue += n(p.service_amount);
    summary.creditCashReceived += n(p.credit_amount);
    summary.creditsIssued += n(p.credits_allocated);
  }

  for (const lot of lots ?? []) {
    const remaining = n(lot.remaining);
    const sell = n(lot.sell_price_at_purchase);
    summary.prepaidOutstandingCredits += remaining;
    summary.prepaidOutstandingValue += remaining * sell;
  }

  for (const e of usage ?? []) {
    const costPerCredit = n(e.credit_price) || 0.3;
    const costCredits = n(e.cost_credits) || (costPerCredit > 0 ? n(e.actual_cost) / costPerCredit : 0);
    const paidCredits = n(e.paid_credits);
    const lotId = e.credit_lot_id as string | null;
    const sell =
      (lotId ? sellPriceOf.get(lotId) : 0) ||
      costPerCredit * (1 + n(e.profit_rate) / 100);

    summary.underlyingCost += n(e.actual_cost);
    summary.underlyingCostCredits += costCredits;
    summary.realisedUsageCredits += paidCredits;
    summary.realisedUsageRevenue += paidCredits * sell;

    // Only usage the customer never funded is exposure.
    const status = String(e.payment_status ?? "free");
    if (status === "unpaid" || status === "partial" || status === "free" || status === "staff") {
      const unfundedCredits = Math.max(costCredits - paidCredits, 0);
      summary.exposureCredits += unfundedCredits;
      summary.exposure += unfundedCredits * costPerCredit;
    }
  }

  summary.realisedProfit = summary.realisedUsageRevenue - summary.underlyingCost;
  summary.netResult =
    summary.subscriptionRevenue + summary.realisedUsageRevenue - summary.underlyingCost - summary.refunds;

  return summary;
}
