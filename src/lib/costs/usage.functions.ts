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
