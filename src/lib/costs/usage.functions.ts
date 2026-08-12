import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COST_CATEGORIES } from "./categories";

const range = z.object({ from: z.string().min(4), to: z.string().min(4) });
const scope = range.extend({ costUnitId: z.string().uuid().optional() });

async function guard(supabase: any, userId: string) {
  const { assertPlatformAdmin } = await import("./costAdmin.server");
  await assertPlatformAdmin(supabase, userId);
}

export const fetchUsageAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.parse(data))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { usageAnalytics } = await import("./usageAnalytics.server");
    return usageAnalytics(data.from, data.to, data.costUnitId);
  });

export const fetchCategoryEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scope.extend({ category: z.enum(COST_CATEGORIES) }).parse(data))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { categoryEvents } = await import("./usageAnalytics.server");
    return { rows: await categoryEvents(data.from, data.to, data.category, data.costUnitId) };
  });

export const fetchRevenueLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    scope.extend({ status: z.string().max(30).optional(), query: z.string().max(120).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { revenueLedger } = await import("./usageAnalytics.server");
    return revenueLedger(data.from, data.to, {
      costUnitId: data.costUnitId,
      status: data.status,
      query: data.query,
    });
  });

export const fetchAccountOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => range.extend({ query: z.string().max(120).optional() }).parse(data))
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { accountOptions } = await import("./usageAnalytics.server");
    return { rows: await accountOptions(data.from, data.to, data.query ?? "") };
  });

export const grantAccountCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        costUnitId: z.string().uuid(),
        amount: z.number().min(-1_000_000).max(1_000_000),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { grantCredits } = await import("./usageAnalytics.server");
    return { balance: await grantCredits(data.costUnitId, data.amount, data.note ?? "Administrator adjustment") };
  });

export const fetchPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const { promoCodes } = await import("./usageAnalytics.server");
    return { rows: await promoCodes() };
  });

export const savePromoCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        code: z.string().min(2).max(40),
        kind: z.enum(["discount", "staff"]),
        discountPercentage: z.number().min(0).max(100),
        label: z.string().max(120).optional(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { savePromoCode } = await import("./usageAnalytics.server");
    return { rows: await savePromoCode(data) };
  });

/**
 * Import a day of real platform usage (Lovable credit meter) for one account.
 * Re-importing the same day replaces it, so figures never double count.
 */
export const importPlatformUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        costUnitId: z.string().uuid(),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        creditRate: z.number().min(0).max(1000),
        rows: z
          .array(
            z.object({
              category: z.enum(COST_CATEGORIES),
              credits: z.number().min(0).max(10_000_000),
              model: z.string().max(120).optional(),
              label: z.string().max(120).optional(),
            }),
          )
          .min(1)
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { data: count, error } = await context.supabase.rpc("import_platform_usage", {
      _cost_unit_id: data.costUnitId,
      _day: data.day,
      _rows: data.rows,
      _credit_rate: data.creditRate,
    });
    if (error) throw new Error(error.message);
    return { imported: Number(count ?? 0) };
  });

/** Record money received against an account's unpaid usage, oldest first. */
export const recordUsagePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ costUnitId: z.string().uuid(), amount: z.number().min(0).max(1_000_000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await guard(context.supabase, context.userId);
    const { data: applied, error } = await context.supabase.rpc("apply_usage_payment", {
      _cost_unit_id: data.costUnitId,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return { applied: Number(applied ?? 0) };
  });

/** A signed-in account's own credit balance — no cost or margin is exposed. */
export const fetchMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("my_credit_balance");
    return { balance: Number(data ?? 0) };
  });


export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: result } = await context.supabase.rpc("redeem_promo_code", { _code: data.code });
    return { result: String(result ?? "invalid") };
  });
