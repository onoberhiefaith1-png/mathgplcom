// WHICH LESSON NOTE IS LIVE FOR A CLASS
//
// The class SmartBoard has exactly one live lesson note at a time, stored in
// `class_smartboard_state.notebook_id`. The teacher's own screen renders the
// note from the URL, but every student screen reads THIS field — so if the
// write ever fails, students silently keep watching the previous note.
//
// That is exactly what happened: the switch wrote `state_json: null` to clear
// the previous board drawing, but `state_json` is NOT NULL, so the whole row
// write was rejected and `notebook_id` never moved. The payload builders below
// exist so that can never regress: the live-note write NEVER carries a null
// board snapshot, and clearing the snapshot is a separate write using `{}`.

import { supabase } from "@/integrations/supabase/client";

export type ActiveNotePayload = {
  class_id: string;
  notebook_id: string;
  updated_at: string;
};

/** Row payload that publishes the live note. Never contains `state_json`. */
export const activeNotePayload = (
  classId: string,
  notebookId: string,
  now: string = new Date().toISOString(),
): ActiveNotePayload => ({
  class_id: classId,
  notebook_id: notebookId,
  updated_at: now,
});

/** Separate payload that resets the recovery snapshot with a legal value. */
export const clearSnapshotPayload = (now: string = new Date().toISOString()) => ({
  state_json: {} as never,
  updated_at: now,
});

export type PublishResult =
  | { ok: true; notebookId: string }
  | { ok: false; error: string };

/**
 * Publish `notebookId` as the live note for `classId`, then read the row back
 * and retry once if it did not land. Callers surface the failure to the teacher
 * instead of leaving students on a stale note.
 */
export const publishActiveNote = async (
  classId: string,
  notebookId: string,
  opts: { clearSnapshot?: boolean } = {},
): Promise<PublishResult> => {
  const write = async () => {
    const { error } = await supabase
      .from("class_smartboard_state")
      .upsert(activeNotePayload(classId, notebookId), { onConflict: "class_id" });
    return error?.message ?? null;
  };

  let failure = await write();

  if (!failure && opts.clearSnapshot) {
    // A recovery snapshot is only valid for the lesson that produced it.
    const { error } = await supabase
      .from("class_smartboard_state")
      .update(clearSnapshotPayload())
      .eq("class_id", classId);
    if (error) console.warn("[class-smartboard] could not reset board snapshot", error.message);
  }

  const verify = async () => {
    const { data } = await supabase
      .from("class_smartboard_state")
      .select("notebook_id")
      .eq("class_id", classId)
      .maybeSingle();
    return (data as { notebook_id?: string | null } | null)?.notebook_id ?? null;
  };

  let live = failure ? null : await verify();
  if (live !== notebookId) {
    failure = await write();
    live = failure ? null : await verify();
  }

  if (live === notebookId) return { ok: true, notebookId };
  return { ok: false, error: failure ?? "the class board did not accept the change" };
};
