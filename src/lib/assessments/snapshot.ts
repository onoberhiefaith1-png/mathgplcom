// Frozen copies of assigned questions.
//
// A question handed out to students must never depend on the Lesson Note it
// came from. The instant it is assigned, the compiled payload — question text,
// every floating chip, its containers, per-line marks, notes, note-only lines
// and table workspaces — plus the hidden answer key are copied here. From then
// on the student version reads this copy only, so editing, moving, renaming or
// deleting the note cannot change or break it.
//
// The copy lives for as long as the item that handed it out: removing the link,
// the card or the course removes it, and nothing else does.

import { supabase } from "@/integrations/supabase/client";
import type { AnswerKeyLine, QuestionPayload } from "@/lib/assessments/createAssessment";

type Db = { from: (table: string) => any };
const db = supabase as unknown as Db;

const TABLE = "assigned_questions";
const KEYS = "assigned_question_keys";

export interface FrozenQuestion {
  id: string;
  question: QuestionPayload;
  totalMarks: number;
  label: string;
}

export interface FreezeSource {
  notebookId?: string | null;
  sectionId?: string | null;
  subsectionId?: string | null;
  label?: string | null;
}

/** Marks carried by a payload — the single definition used everywhere. */
export const questionMarks = (question: QuestionPayload | null | undefined): number =>
  (question?.lines ?? []).reduce((sum, line) => sum + (Number(line.marks) || 0), 0);

/**
 * Store one immutable copy of a compiled question and its answer key.
 * Returns the copy's id, or null when it could not be written (the caller's
 * existing behaviour must never break because of the copy).
 */
export const freezeQuestion = async (args: {
  question: QuestionPayload;
  answerKey?: AnswerKeyLine[];
  source?: FreezeSource;
}): Promise<string | null> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;

    const { data, error } = await db
      .from(TABLE)
      .insert({
        owner_id: uid,
        source_notebook_id: args.source?.notebookId ?? null,
        source_section_id: args.source?.sectionId ?? null,
        source_subsection_id: args.source?.subsectionId ?? null,
        label: args.source?.label ?? "",
        question: args.question as never,
        total_marks: questionMarks(args.question),
      })
      .select("id")
      .single();
    if (error || !data) return null;
    const id = (data as { id: string }).id;

    const lines = args.answerKey ?? [];
    if (lines.length > 0) {
      await db
        .from(KEYS)
        .upsert({ assigned_question_id: id, lines: lines as never }, { onConflict: "assigned_question_id" });
    }
    return id;
  } catch {
    return null;
  }
};

const toFrozen = (row: Record<string, any>): FrozenQuestion => ({
  id: row["id"],
  question: row["question"] as QuestionPayload,
  totalMarks: Number(row["total_marks"] ?? 0) || questionMarks(row["question"] as QuestionPayload),
  label: String(row["label"] ?? ""),
});

/** Read many copies at once, keyed by copy id. */
export const readFrozenQuestions = async (
  ids: (string | null | undefined)[],
): Promise<Map<string, FrozenQuestion>> => {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const out = new Map<string, FrozenQuestion>();
  if (wanted.length === 0) return out;
  const { data } = await db.from(TABLE).select("id, question, total_marks, label").in("id", wanted);
  for (const row of ((data ?? []) as Record<string, any>[])) {
    if (!row["question"]) continue;
    out.set(row["id"], toFrozen(row));
  }
  return out;
};

/** Read one copy, or null when it is gone. */
export const readFrozenQuestion = async (id: string): Promise<FrozenQuestion | null> => {
  const map = await readFrozenQuestions([id]);
  return map.get(id) ?? null;
};

/** The hidden answer key of one copy. Owner-readable only. */
export const readFrozenAnswerKeys = async (
  ids: (string | null | undefined)[],
): Promise<Map<string, AnswerKeyLine[]>> => {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const out = new Map<string, AnswerKeyLine[]>();
  if (wanted.length === 0) return out;
  const { data } = await db.from(KEYS).select("assigned_question_id, lines").in("assigned_question_id", wanted);
  for (const row of ((data ?? []) as Record<string, any>[])) {
    const lines = Array.isArray(row["lines"]) ? (row["lines"] as AnswerKeyLine[]) : [];
    out.set(row["assigned_question_id"], lines);
  }
  return out;
};

/** Remove a copy — only ever called when its owning item is removed. */
export const deleteFrozenQuestion = async (id: string | null | undefined): Promise<void> => {
  if (!id) return;
  await db.from(TABLE).delete().eq("id", id);
};
