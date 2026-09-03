/**
 * ROOM LOCK — server side. Setting a code requires building-edit rights; the
 * code itself is hashed before it is stored and is never read back. Checking a
 * code returns nothing but a yes/no, so a locked room gives away no secret.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hashCode, MAX_CODE_LENGTH, MIN_CODE_LENGTH, normaliseCode, validateCode } from "./lock";
import type { LockCharset } from "./lock";

const charsetSchema = z.enum(["digits", "letters", "alphanumeric"]);

const setSchema = z.object({
  roomId: z.string().uuid(),
  code: z.string().min(MIN_CODE_LENGTH).max(MAX_CODE_LENGTH),
  charset: charsetSchema,
  codeLength: z.number().int().min(MIN_CODE_LENGTH).max(MAX_CODE_LENGTH),
  /** Optional security policy. Null / omitted means "no attempt limit". */
  maxAttempts: z.number().int().min(1).max(20).nullable().optional(),
  retryAfterMinutes: z.number().int().min(1).max(20160).nullable().optional(),
});


type EditCheckClient = {
  rpc: (fn: "can_edit_building", args: { _building_id: string }) => PromiseLike<{ data: unknown }>;
};

async function assertCanEdit(supabase: EditCheckClient, buildingId: string) {
  const { data } = await supabase.rpc("can_edit_building", { _building_id: buildingId });
  if (!data) throw new Error("You do not have permission to edit this building.");
}

/**
 * A lock belongs to a room, so the building it lives in is the room's own —
 * never something the caller has to say.
 */
async function buildingOfRoom(roomId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("building_classrooms")
    .select("building_id")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.building_id) throw new Error("This room no longer exists.");
  return data.building_id as string;
}

/** Attach a lock to one room, or replace the code on the lock already there. */
export const setRoomLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setSchema.parse(data))
  .handler(async ({ data, context }) => {
    const buildingId = await buildingOfRoom(data.roomId);
    await assertCanEdit(context.supabase, buildingId);
    const charset = data.charset as LockCharset;
    const problem = validateCode(data.code, charset, data.codeLength);
    if (problem) throw new Error(problem);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code_hash = await hashCode(data.code, data.roomId);
    const { error } = await supabaseAdmin.from("building_room_locks").upsert(
      {
        building_id: buildingId,
        classroom_id: data.roomId,
        code_hash,
        charset,
        code_length: data.codeLength,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "classroom_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, charset, codeLength: data.codeLength };
  });

/** Take the lock off a room. The room then opens exactly as an unlocked room. */
export const removeRoomLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ roomId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context.supabase, await buildingOfRoom(data.roomId));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("building_room_locks")
      .delete()
      .eq("classroom_id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Check an entered code. The answer is a bare boolean — never the code, never
 * its length, never a hint about how close the attempt was.
 */
export const verifyRoomLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ roomId: z.string().uuid(), code: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lock } = await supabaseAdmin
      .from("building_room_locks")
      .select("code_hash")
      .eq("classroom_id", data.roomId)
      .maybeSingle();
    // No lock on this room: nothing to unlock, and nothing to refuse either.
    if (!lock?.code_hash) return { ok: true };
    const attempt = await hashCode(normaliseCode(data.code), data.roomId);
    return { ok: attempt === lock.code_hash };
  });
