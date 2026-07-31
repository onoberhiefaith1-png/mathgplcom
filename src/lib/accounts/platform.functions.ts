import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as platform from "./platformAdmin.server";

export const fetchPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return platform.platformStats();
  });

export const fetchPlatformAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ kind: z.enum(["schools", "teachers", "parents", "students", "admins"]) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await platform.platformAccounts(data.kind) };
  });
