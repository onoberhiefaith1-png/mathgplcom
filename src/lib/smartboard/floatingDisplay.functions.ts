import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeFloatingStyle } from "./floatingDisplayStyles";
import type { FloatingStyleState } from "./floatingDisplay.server";

/** Effective floating-number display style for the signed-in person. */
export const getFloatingDisplayStyle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FloatingStyleState> => {
    const { readPlatformStyle, readUserStyle } = await import("./floatingDisplay.server");
    const [platformDefault, userChoice] = await Promise.all([
      readPlatformStyle(context.supabase),
      readUserStyle(context.supabase, context.userId),
    ]);
    return { platformDefault, userChoice };
  });

/** Personal choice — always wins for this person. */
export const setMyFloatingDisplayStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { style: string }) => ({ style: sanitizeFloatingStyle(data?.style) }))
  .handler(async ({ data, context }) => {
    const { writeUserStyle } = await import("./floatingDisplay.server");
    await writeUserStyle(context.supabase, context.userId, data.style);
    return { ok: true as const, style: data.style };
  });

/** Platform default — administrators only (enforced by RLS as well). */
export const setPlatformFloatingDisplayStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { style: string }) => ({ style: sanitizeFloatingStyle(data?.style) }))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const admin = (roles ?? []).some((r: { role: string }) => r.role === "platform_owner" || r.role === "co_admin");
    if (!admin) throw new Error("Only platform administrators can set the default display.");
    const { writePlatformStyle } = await import("./floatingDisplay.server");
    await writePlatformStyle(context.supabase, data.style);
    return { ok: true as const, style: data.style };
  });
