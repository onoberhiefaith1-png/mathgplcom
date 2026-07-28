// Learning assignment instances — the connective tissue between the five
// independent workspaces (Lesson Notes, SmartBoard, Classes, Adventures,
// Class Gallery).
//
// A row in `learning_assignments` is ONE learning session:
//
//     (Lesson Note + Class + Adventure)
//
// Nothing owns anything else. A Lesson Note can be assigned to many classes,
// an Adventure can be reused by many notes and classes, and each class keeps
// exactly one cumulative Gallery.
//
// Lifecycle: active ──(completed / due date / teacher removes)──► archived.
// Archived rows are permanent, read-only history. Re-assigning the same triple
// afterwards creates a BRAND NEW instance starting from zero progress; the old
// one is never revived and never overwritten.

import { supabase } from "@/integrations/supabase/client";

export type AssignmentMode = "assignment" | "adventure";
export type AssignmentStatus = "active" | "archived";

export interface LearningAssignment {
  id: string;
  class_id: string;
  notebook_id: string;
  game_id: string | null;
  question_keys: string[];
  mode: AssignmentMode;
  status: AssignmentStatus;
  title: string | null;
  due_at: string | null;
  started_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  created_at: string;
}

const table = () => supabase.from("learning_assignments" as never);

const asRow = (r: any): LearningAssignment => ({
  id: r.id,
  class_id: r.class_id,
  notebook_id: r.notebook_id,
  game_id: r.game_id ?? null,
  question_keys: Array.isArray(r.question_keys) ? r.question_keys : [],
  mode: (r.mode ?? "assignment") as AssignmentMode,
  status: (r.status ?? "active") as AssignmentStatus,
  title: r.title ?? null,
  due_at: r.due_at ?? null,
  started_at: r.started_at ?? null,
  archived_at: r.archived_at ?? null,
  archived_reason: r.archived_reason ?? null,
  created_at: r.created_at,
});

const SELECT =
  "id, class_id, notebook_id, game_id, question_keys, mode, status, title, due_at, started_at, archived_at, archived_reason, created_at";

/**
 * The one active instance for this exact combination, if it exists.
 * `mode` is REQUIRED: Adventure and Assignment are independent workspaces, so a
 * lookup must never match across them.
 */
export async function findActiveAssignment(
  classId: string,
  notebookId: string,
  gameId: string | null,
  mode: AssignmentMode,
): Promise<LearningAssignment | null> {
  let q = (table() as any)
    .select(SELECT)
    .eq("class_id", classId)
    .eq("notebook_id", notebookId)
    .eq("mode", mode)
    .eq("status", "active");
  q = gameId ? q.eq("game_id", gameId) : q.is("game_id", null);
  const { data } = await q.limit(1);
  const row = (data ?? [])[0];
  return row ? asRow(row) : null;
}

export interface EnsureResult {
  assignment: LearningAssignment;
  /** false when an active instance for this exact triple already existed. */
  created: boolean;
}

/**
 * Get (or create) the active instance for (Lesson Note + Class + Adventure).
 * Never touches archived instances — reuse after archiving always yields a new
 * instance with fresh progress.
 */
export async function ensureAssignment(params: {
  classId: string;
  notebookId: string;
  gameId?: string | null;
  mode: AssignmentMode;
  questionKeys?: (string | null)[];
  title?: string | null;
  dueAt?: string | null;
}): Promise<EnsureResult> {
  const gameId = params.gameId ?? null;
  const keys = (params.questionKeys ?? []).filter(Boolean) as string[];

  let existing = await findActiveAssignment(params.classId, params.notebookId, gameId, params.mode);

  // A note assigned before an Adventure was chosen has a game-less instance.
  // Choosing the Adventure completes the SAME session — adopt it instead of
  // opening a second one for the same note + class.
  if (!existing && gameId) {
    const gameless = await findActiveAssignment(params.classId, params.notebookId, null, params.mode);
    if (gameless) {
      await (table() as any).update({ game_id: gameId }).eq("id", gameless.id);
      gameless.game_id = gameId;
      existing = gameless;
    }
  }

  if (existing) {
    const merged = Array.from(new Set([...existing.question_keys, ...keys]));
    if (merged.length !== existing.question_keys.length) {
      await (table() as any).update({ question_keys: merged }).eq("id", existing.id);
      existing.question_keys = merged;
    }
    return { assignment: existing, created: false };
  }


  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { data, error } = await (table() as any)
    .insert({
      class_id: params.classId,
      notebook_id: params.notebookId,
      game_id: gameId,
      mode: params.mode,
      status: "active",
      question_keys: keys,
      title: params.title ?? null,
      due_at: params.dueAt ?? null,
      created_by: uid,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    // Lost a race against another tab/teacher creating the SAME
    // (note + class + workspace + adventure) instance — adopt theirs.
    if (error && /duplicate key|active_triple/i.test(error.message ?? "")) {
      const raced = await findActiveAssignment(params.classId, params.notebookId, gameId, params.mode);
      if (raced) return { assignment: raced, created: false };
    }
    throw new Error(error?.message ?? "assignment_create_failed");
  }
  return { assignment: asRow(data), created: true };
}

/**
 * Duplicate guard for the teacher-facing flow: returns the existing active
 * instance so the caller can offer "Open existing" instead of creating a
 * second identical combination. The database also enforces this with a partial
 * unique index, so a race can never produce a duplicate.
 */
export async function checkDuplicate(
  classId: string,
  notebookId: string,
  gameId: string | null,
  mode: AssignmentMode,
): Promise<LearningAssignment | null> {
  return findActiveAssignment(classId, notebookId, gameId, mode);
}

/**
 * End a learning session. Progress, scores, reports and every Gallery reward
 * stay exactly where they are — only the status flips, and the card moves from
 * the Active list to the Archive list.
 */
export async function archiveAssignment(
  assignmentId: string,
  reason: "completed" | "expired" | "teacher" = "teacher",
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Children leave the active dashboards but keep all of their data.
  await supabase
    .from("assessments")
    .update({ unassigned_at: nowIso } as never)
    .eq("assignment_id" as never, assignmentId as never)
    .is("unassigned_at", null);
  await supabase
    .from("class_adventure_notes")
    .update({ unassigned_at: nowIso } as never)
    .eq("assignment_id" as never, assignmentId as never)
    .is("unassigned_at", null);

  await (table() as any)
    .update({ status: "archived", archived_at: nowIso, archived_reason: reason })
    .eq("id", assignmentId)
    .eq("status", "active");
}

/** Archive every active instance of a class whose due date has passed. */
export async function autoArchiveExpired(classId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data } = await (table() as any)
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active")
    .not("due_at", "is", null)
    .lt("due_at", nowIso);
  const rows = (data ?? []) as { id: string }[];
  for (const r of rows) await archiveAssignment(r.id, "expired");
  return rows.length;
}

export async function listAssignments(
  classId: string,
  opts?: { status?: AssignmentStatus; mode?: AssignmentMode },
): Promise<LearningAssignment[]> {
  let q = (table() as any).select(SELECT).eq("class_id", classId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.mode) q = q.eq("mode", opts.mode);
  const { data } = await q.order("created_at", { ascending: false });
  return ((data ?? []) as any[]).map(asRow);
}

export async function getAssignment(id: string): Promise<LearningAssignment | null> {
  const { data } = await (table() as any).select(SELECT).eq("id", id).maybeSingle();
  return data ? asRow(data) : null;
}

/** Read-only gate used by every teacher/student write surface. */
export async function isAssignmentArchived(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  const row = await getAssignment(id);
  return row?.status === "archived";
}

/** The set of archived instance ids for a class — cheap client-side filter. */
export async function archivedAssignmentIds(classId: string): Promise<Set<string>> {
  const rows = await listAssignments(classId, { status: "archived" });
  return new Set(rows.map((r) => r.id));
}
