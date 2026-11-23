import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlatformAdmin } from "./platformAdmin.server";

export const requestSupportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { requestSupportAccess: send } = await import("./supportAccess.server");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name, first_name, last_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const adminName =
      profile?.display_name?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      "A platform administrator";
    return send(context.userId, data.userId, adminName);
  });
