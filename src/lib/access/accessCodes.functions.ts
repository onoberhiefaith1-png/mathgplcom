/**
 * Administrative management of secret-entrance access codes: generate, watch,
 * disable and delete. Only platform administrators reach any of it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlatformAdmin } from "@/lib/costs/costAdmin.server";

export type AccessCodeRow = {
  id: string;
  code: string;
  label: string | null;
  active: boolean;
  revokedAt: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  holderName: string | null;
  holderId: string | null;
  expiresAt: string | null;
};

async function listCodes(): Promise<AccessCodeRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: codes } = await supabaseAdmin
    .from("staff_codes")
    .select("id, code, label, active, revoked_at, claimed_by, claimed_at, expires_at")
    .eq("purpose", "access")
    .order("created_at", { ascending: false })
    .limit(200);

  const holders = (codes ?? []).map((c) => c.claimed_by as string | null).filter(Boolean) as string[];
  const names = new Map<string, { name: string | null; id: string | null }>();
  if (holders.length) {
    const [{ data: profiles }, { data: ids }] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id, full_name").in("user_id", holders),
      supabaseAdmin.from("account_ids").select("user_id, mathgpl_id").in("user_id", holders),
    ]);
    for (const p of profiles ?? []) names.set(p.user_id as string, { name: (p.full_name as string) ?? null, id: null });
    for (const i of ids ?? []) {
      const prev = names.get(i.user_id as string) ?? { name: null, id: null };
      names.set(i.user_id as string, { ...prev, id: (i.mathgpl_id as string) ?? null });
    }
  }

  return (codes ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    label: (c.label as string) ?? null,
    active: c.active !== false,
    revokedAt: (c.revoked_at as string) ?? null,
    claimedBy: (c.claimed_by as string) ?? null,
    claimedAt: (c.claimed_at as string) ?? null,
    holderName: c.claimed_by ? names.get(c.claimed_by as string)?.name ?? null : null,
    holderId: c.claimed_by ? names.get(c.claimed_by as string)?.id ?? null : null,
    expiresAt: (c.expires_at as string) ?? null,
  }));
}

export const fetchAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await listCodes() };
  });

const generated = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `MG-${out.slice(0, 5)}-${out.slice(5)}`;
};

export const createAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ label: z.string().max(120).optional() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("staff_codes").insert({
      code: generated(),
      label: data.label?.trim() || null,
      entitlement: "pro",
      purpose: "access",
      active: true,
      created_by: context.userId,
    });
    return { rows: await listCodes() };
  });

export const setAccessCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("staff_codes")
      .update({ active: data.active, revoked_at: data.active ? null : new Date().toISOString() })
      .eq("id", data.id);
    await supabaseAdmin.from("staff_redemptions").update({ active: data.active }).eq("code_id", data.id);
    return { rows: await listCodes() };
  });

export const deleteAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("staff_codes").delete().eq("id", data.id);
    return { rows: await listCodes() };
  });
