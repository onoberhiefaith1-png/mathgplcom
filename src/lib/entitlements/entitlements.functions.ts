import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** What the signed-in account may do: own plan plus connection-provided access. */
export const fetchMyEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { myEntitlements } = await import("./entitlements.server");
    return myEntitlements(context.supabase, context.userId);
  });

/** Server-side confirmation used by handlers before a protected action. */
export const checkEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ feature: z.string().min(2).max(60) }).parse(data))
  .handler(async ({ context, data }) => {
    const { hasEntitlement } = await import("./entitlements.server");
    const { upgradeMessage } = await import("./features");
    const allowed = await hasEntitlement(context.userId, data.feature as never);
    return { allowed, message: allowed ? null : upgradeMessage(data.feature as never) };
  });

/* ─────────── administrator ─────────── */

export const fetchPlanEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/costs/costAdmin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { planEntitlementMap, featureCatalogue } = await import("./entitlements.server");
    const [map, catalogue] = await Promise.all([planEntitlementMap(), featureCatalogue()]);
    return { map, catalogue };
  });

export const savePlanEntitlementsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        planId: z.string().uuid(),
        features: z.array(z.string().max(60)).max(80),
        limits: z.record(z.string().max(40), z.number().int().min(0).max(1_000_000).nullable()),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertPlatformAdmin } = await import("@/lib/costs/costAdmin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { savePlanEntitlements } = await import("./entitlements.server");
    return { map: await savePlanEntitlements(data) };
  });
