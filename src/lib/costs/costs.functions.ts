import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COST_CATEGORIES } from "./categories";
import * as costs from "./costAdmin.server";

const range = z.object({ from: z.string().min(4), to: z.string().min(4) });

export const fetchCostOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => range.parse(data))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return costs.costOverview(data.from, data.to);
  });

export const fetchProfitReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => range.extend({ query: z.string().max(120).optional() }).parse(data))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.profitReport(data.from, data.to, data.query ?? "") };
  });

export const fetchCostUnitDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => range.extend({ costUnitId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { detail: await costs.costUnitDetail(data.costUnitId, data.from, data.to) };
  });

export const fetchPriceBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.priceBook() };
  });

export const saveResourcePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        metric: z.string().min(3).max(80),
        unitPrice: z.number().min(0).max(1_000_000).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.setPrice(data.metric, data.unitPrice) };
  });

/** Insert-only history of the global Percentage Profit. */
export const fetchPricingHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.pricingHistory() };
  });

/**
 * Saving a new Percentage Profit records a new pricing version. It applies to
 * new subscriptions and renewals only — active subscriptions keep the
 * percentage locked when they started, and past events are never repriced.
 */
export const saveProfitPercentage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ value: z.number().min(0).max(1000) }).parse(data))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    const value = await costs.setProfitPercentage(data.value, context.userId);
    return { value, rows: await costs.pricingHistory() };
  });


/** Buy rate per currency: the monetary value of one credit. */
export const fetchCurrencyRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.currencyRates() };
  });

export const saveCurrencyRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ currency: z.string().min(3).max(6), creditValue: z.number().min(0).max(1_000_000) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.setCurrencyRate(data.currency, data.creditValue, context.userId) };
  });

/** Reprice historical events after a price-book correction. */
export const reconcileCosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ days: z.number().min(1).max(400).optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { repriced: await costs.reconcile(data.days ?? 90) };
  });

/**
 * Client-side metering hand-off. The caller only reports what it measured
 * (bytes uploaded, realtime minutes held open); the owner of the cost is
 * always derived from the bearer token, never from the request body.
 */
const CLIENT_METRICS = [
  "storage.gb_month",
  "realtime.minutes",
  "realtime.messages",
  "network.egress_gb",
  "database.rows_written",
] as const;

export const reportUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        metric: z.enum(CLIENT_METRICS),
        quantity: z.number().positive().max(100_000),
        unit: z.string().max(40).optional(),
        feature: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { recordUsage, activeOrgOf } = await import("./meter.server");
    await recordUsage({
      userId: context.userId,
      orgId: await activeOrgOf(context.userId),
      metric: data.metric,
      quantity: data.quantity,
      unit: data.unit ?? "unit",
      feature: data.feature ?? "client",
    });
    return { ok: true, categories: COST_CATEGORIES.length };
  });

/* ─────────── Platform credit economy ─────────── */

export const fetchCreditInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { inventory: await costs.creditInventory() };
  });

/** Rate periods usage was recorded under — read-only, never repriced. */
export const fetchLockedRatePeriods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.lockedRatePeriods() };
  });


export const saveCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        credits: z.number().positive().max(100_000_000),
        unitCost: z.number().min(0).max(1_000_000),
        currency: z.string().min(3).max(6).optional(),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { inventory: await costs.addCreditPurchase({ ...data, userId: context.userId }) };
  });

/** Cost price, profit percentage and the resulting sell price per currency. */
export const fetchPricingEngine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    const [base, currencies, plans] = await Promise.all([
      costs.resolvePricing("GBP"),
      costs.currencyPricing(),
      costs.planCatalogue(),
    ]);
    return { base, currencies, plans };
  });

export const saveCurrencyPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        currency: z.string().min(3).max(6),
        creditValue: z.number().min(0).max(1_000_000),
        profitPercentage: z.number().min(0).max(10_000).nullable(),
        followsBase: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.setCurrencyPricing({ ...data, userId: context.userId }) };
  });

export const savePlanPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        key: z.string().min(2).max(60),
        subscriptionAmount: z.number().min(0).max(1_000_000),
        creditAmount: z.number().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { plans: await costs.savePlanAmounts(data) };
  });

export const fetchStaffCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.staffCodes() };
  });

export const saveStaffCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        code: z.string().min(2).max(40),
        label: z.string().max(120).optional(),
        entitlement: z.string().min(2).max(40),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.saveStaffCode({ ...data, userId: context.userId }) };
  });

/** Any signed-in member can redeem a staff code; entitlement, never money. */
export const redeemStaffCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("redeem_staff_code", { _code: data.code });
    if (error) throw new Error(error.message);
    return { result: String(result ?? "invalid") };
  });

/**
 * The caller's own credit position: balance, what is held for work in flight,
 * what is still spendable, and whether AI generation is part of their plan.
 * This is the only credit check the browser is allowed to rely on for display —
 * the server enforces the same numbers again before any chargeable work runs.
 */
export const fetchCreditHeadroom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const credits = await import("./creditContext.server");
    const orgId = await credits.activeOrgFor(context.userId);
    const [head, aiAllowed] = await Promise.all([
      credits.creditHeadroom(context.userId, orgId),
      credits.planAllowsAi(context.userId, orgId),
    ]);
    const canStart = !head.enforced || (!head.blockedReason && head.available > head.startFloor);
    return {
      ...head,
      aiAllowed,
      canStart,
      reason: head.blockedReason ?? (canStart ? null : "floor"),
    };
  });

/**
 * The account's own credit balance and plain activity list: what they did and
 * how many credits it cost. No provider cost, margin or pricing internals.
 */
export const fetchCreditActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { creditActivity } = await import("./creditAccount.server");
    return creditActivity(context.userId, 40);
  });

/** The payer's switch for chargeable actions. */
export const saveCreditUsageEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { setCreditUsageEnabled, creditActivity } = await import("./creditAccount.server");
    await setCreditUsageEnabled(context.userId, data.enabled);
    return creditActivity(context.userId, 40);
  });


/**
 * Read-only credit lots, newest first. Each lot keeps the economic terms it was
 * purchased under; consumption is FIFO, oldest lot first.
 */
export const fetchCreditLots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ limit: z.number().min(1).max(200).optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    await costs.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await costs.creditLots(data.limit ?? 60) };
  });
