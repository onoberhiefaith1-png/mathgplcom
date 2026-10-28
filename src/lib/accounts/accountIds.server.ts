/**
 * Server-only access to `account_ids`, including the chosen-ID columns.
 *
 * The generated database types are regenerated after the schema change lands,
 * so the chosen-ID columns are reached through a deliberately loose table
 * handle here instead of leaking casts across the feature.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AccountIdRow = {
  user_id: string;
  mathgpl_id: string;
  custom_id: string | null;
  custom_id_history: unknown;
};

async function table() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin as any).from("account_ids");
}

/** The account holding this exact chosen ID (case-insensitive), if any. */
export async function userIdByCustomId(customId: string): Promise<string | null> {
  const { data } = await (await table()).select("user_id").ilike("custom_id", customId).maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

/** The account holding this exact issued ID, if any. */
export async function userIdByIssuedId(issuedId: string): Promise<string | null> {
  const { data } = await (await table()).select("user_id").eq("mathgpl_id", issuedId).maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

/** Does any issued ID equal this entry? Chosen IDs may never imitate one. */
export async function issuedIdExists(value: string): Promise<boolean> {
  const { data } = await (await table()).select("user_id").ilike("mathgpl_id", value).maybeSingle();
  return Boolean((data as { user_id?: string } | null)?.user_id);
}

export async function accountIdRow(userId: string): Promise<Partial<AccountIdRow> | null> {
  const { data } = await (await table())
    .select("user_id, mathgpl_id, custom_id, custom_id_history")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Partial<AccountIdRow> | null) ?? null;
}

export async function writeCustomId(
  userId: string,
  customId: string,
  history: unknown[],
): Promise<{ ok: boolean; duplicate?: boolean }> {
  const { error } = await (await table())
    .update({
      custom_id: customId,
      custom_id_updated_at: new Date().toISOString(),
      custom_id_history: history,
    })
    .eq("user_id", userId);

  if (!error) return { ok: true };
  const duplicate = error.code === "23505" || /duplicate key/i.test(error.message ?? "");
  return { ok: false, duplicate };
}
