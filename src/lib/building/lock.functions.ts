/**
 * DOOR LOCK — server side. Setting a code requires building-edit rights; the
 * code itself is hashed before it is stored and is never read back. Checking a
 * code returns nothing but a yes/no, so a locked door gives away no secret.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hashCode, MAX_CODE_LENGTH, MIN_CODE_LENGTH, normaliseCode, validateCode } from "./lock";
import type { LockCharset } from "./lock";

const charsetSchema = z.enum(["digits", "letters", "alphanumeric"]);

const setSchema = z.object({
  buildingId: z.string().uuid(),
  doorId: z.string().uuid(),
  code: z.string().min(MIN_CODE_LENGTH).max(MAX_CODE_LENGTH),
  charset: charsetSchema,
  codeLength: z.number().int().min(MIN_CODE_LENGTH).max(MAX_CODE_LENGTH),
});

async function assertCanEdit(supabase: { rpc: (fn: string, args: object) => Promise<{ data: unknown }> }, buildingId: string) {
  const { data } = await supabase.rpc("can_edit_building", { _building_id: buildingId });
  if (!data) throw new Error("You do not have permission to edit this building.");
}

/** Attach a lock to one door, or replace the code on the lock already there. */
export const setDoorLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.buildingId);
    const charset = data.charset as LockCharset;
    const problem = validateCode(data.code, charset, data.codeLength);
    if (problem) throw new Error(problem);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code_hash = await hashCode(data.code, data.doorId);
    const { error } = await supabaseAdmin
      .from("building_door_locks")
      .upsert(
        {
          building_id: data.buildingId,
          door_id: data.doorId,
          code_hash,
          charset,
          code_length: data.codeLength,
          created_by: context.userId,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "door_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, charset, codeLength: data.codeLength };
  });

/** Take the lock off a door. The door then behaves exactly as an open door. */
export const removeDoorLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ buildingId: z.string().uuid(), doorId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, data.buildingId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("building_door_locks").delete().eq("door_id", data.doorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Check an entered code. The answer is a bare boolean — never the code, never
 * its length, never a hint about how close the attempt was.
 */
export const verifyDoorLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ doorId: z.string().uuid(), code: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lock } = await supabaseAdmin
      .from("building_door_locks")
      .select("code_hash, door_id")
      .eq("door_id", data.doorId)
      .maybeSingle();
    // No lock on this door: nothing to unlock, and nothing to refuse either.
    if (!lock?.code_hash) return { ok: true };
    const attempt = await hashCode(normaliseCode(data.code), data.doorId);
    return { ok: attempt === (lock.code_hash as string) };
  });
