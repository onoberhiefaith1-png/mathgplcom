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

export const fetchAccountDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return platform.accountDetail(data.userId);
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return platform.setAccountStatus(data.userId, data.status);
  });

export const deletePlatformAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    return platform.deleteAccount(data.userId);
  });

export const createPlatformAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        role: z.enum(["school", "teacher", "parent", "student", "co_admin"]),
        name: z.string().trim().max(120).optional(),
        organisation: z.string().trim().max(160).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return platform.createAccount(data);
  });

/** Platform-owner workspace entry: returns a one-time sign-in token. */
export const enterWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await platform.assertPlatformAdmin(context.supabase, context.userId);
    return platform.workspaceEntryToken(context.userId, data.userId);
  });
