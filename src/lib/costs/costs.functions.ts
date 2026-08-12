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
