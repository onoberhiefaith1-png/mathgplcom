/**
 * The permanent list of Asset Library managers. Only the platform owner (or a
 * co-admin) may read or change it; a manager itself simply gains add / edit /
 * delete power on the Assets pages.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlatformAdmin } from "@/lib/costs/costAdmin.server";

export type AssetManagerRow = {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  note: string | null;
  grantedAt: string;
};

async function listManagers(): Promise<AssetManagerRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("asset_managers")
    .select("id, user_id, note, granted_at")
    .order("granted_at", { ascending: true })
    .limit(200);

  const ids = (rows ?? []).map((r) => r.user_id as string);
  const names = new Map<string, string | null>();
  const emails = new Map<string, string | null>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    for (const p of profiles ?? []) names.set(p.user_id as string, (p.full_name as string) ?? null);
    for (const id of ids) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      emails.set(id, data.user?.email ?? null);
    }
  }

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    email: emails.get(r.user_id as string) ?? null,
    name: names.get(r.user_id as string) ?? null,
    note: (r.note as string) ?? null,
    grantedAt: r.granted_at as string,
  }));
}

export const fetchAssetManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    return { rows: await listManagers() };
  });

export const grantAssetManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ email: z.string().email(), note: z.string().max(160).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    // Resolve the account by email through the auth admin listing.
    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const hit = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) userId = hit.id;
      if (!list?.users?.length || list.users.length < 200) break;
    }
    if (!userId) throw new Error(`No account found for ${email}.`);

    await supabaseAdmin
      .from("asset_managers")
      .upsert(
        { user_id: userId, granted_by: context.userId, note: data.note?.trim() || null },
        { onConflict: "user_id" },
      );
    return { rows: await listManagers() };
  });

export const revokeAssetManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("asset_managers").delete().eq("id", data.id);
    return { rows: await listManagers() };
  });
