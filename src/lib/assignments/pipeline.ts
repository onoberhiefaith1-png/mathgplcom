// THE assignment pipeline — single source of truth for
//   Lesson Note question ─► class assignment ─► adventure ─► progress bar.
//
// RULE 0 — A TICK IS PERMANENT.
// Every assignment is keyed on the question's `stable_key`, an identity that
// survives note edits, re-saves and re-generation. A tick can only be removed
// by the teacher explicitly un-ticking and confirming. Assign is idempotent:
// re-assigning a question that was previously removed revives the SAME row, so
// duplicates are impossible (a partial unique index enforces this in the
// database as well).

import { supabase } from "@/integrations/supabase/client";
import {
  compileSectionQuestions,
  compileQuestionSections,
  type AssessmentKind,
} from "@/lib/assessments/createAssessment";

export interface QuestionRef {
  subsectionId: string | null;
  sectionId: string | null;
  questionKey: string | null;
}

/** Resolve the permanent identity of the question a teacher clicked. */
export async function resolveQuestionRef(subsectionId: string | null): Promise<QuestionRef> {
  if (!subsectionId) return { subsectionId: null, sectionId: null, questionKey: null };
  const { data: sub } = await supabase
    .from("notebook_subsections")
    .select("section_id")
    .eq("id", subsectionId)
    .maybeSingle();
  const sectionId = (sub as any)?.section_id as string | undefined;
  if (!sectionId) return { subsectionId, sectionId: null, questionKey: null };
  const { data: sec } = await supabase
    .from("notebook_sections")
    .select("stable_key")
    .eq("id", sectionId)
    .maybeSingle();
  return {
    subsectionId,
    sectionId,
    questionKey: ((sec as any)?.stable_key as string) ?? null,
  };
}

export interface AssignmentState {
  /** class_id → active assessment id */
  assignmentByClass: Map<string, string>;
  /** class_id → active class_adventure_notes id */
  adventureByClass: Map<string, string>;
}

/** Which classes currently hold this exact question, per target. */
export async function loadAssignmentState(
  notebookId: string,
  ref: QuestionRef,
): Promise<AssignmentState> {
  const assignmentByClass = new Map<string, string>();
  const adventureByClass = new Map<string, string>();
  if (!notebookId || (!ref.questionKey && !ref.sectionId)) {
    return { assignmentByClass, adventureByClass };
  }

  const matches = (row: any) =>
    (ref.questionKey && row.question_key === ref.questionKey) ||
    (!row.question_key && ref.sectionId && row.section_id === ref.sectionId);

  const [{ data: assessments }, { data: adventures }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, class_id, kind, section_id, question_key")
      .eq("notebook_id", notebookId)
      .neq("kind", "adventure")
      .is("unassigned_at", null),
    supabase
      .from("class_adventure_notes")
      .select("id, class_id, section_id, question_key")
      .eq("notebook_id", notebookId)
      .is("unassigned_at", null),
  ]);

  for (const r of (assessments ?? []) as any[]) {
    if (matches(r)) assignmentByClass.set(r.class_id as string, r.id as string);
  }
  for (const r of (adventures ?? []) as any[]) {
    if (matches(r)) adventureByClass.set(r.class_id as string, r.id as string);
  }
  return { assignmentByClass, adventureByClass };
}

/** Ids of archived instances for a class — rows under them are history and
 *  must never be revived by a new assignment. */
async function archivedIds(classId: string): Promise<Set<string>> {
  const { data } = await (supabase.from("learning_assignments" as never) as any)
    .select("id")
    .eq("class_id", classId)
    .eq("status", "archived");
  return new Set(((data ?? []) as any[]).map((r) => r.id as string));
}

/** Find the one reusable row (active OR un-ticked) for this question. Rows that
 *  belong to an archived instance are skipped — they are permanent history. */
async function findAdventureRow(
  classId: string,
  notebookId: string,
  ref: QuestionRef,
): Promise<{ id: string } | null> {
  const [{ data }, archived] = await Promise.all([
    supabase
      .from("class_adventure_notes")
      .select("id, section_id, question_key, unassigned_at, created_at, assignment_id")
      .eq("class_id", classId)
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false }),
    archivedIds(classId),
  ]);
  const rows = ((data ?? []) as any[]).filter((r) => !archived.has(r.assignment_id));
  const hit =
    (ref.questionKey && rows.find((r) => r.question_key === ref.questionKey)) ||
    (ref.sectionId && rows.find((r) => !r.question_key && r.section_id === ref.sectionId));
  return hit ? { id: hit.id as string } : null;
}

/** Assign (or revive) a question to a class as an Adventure. Idempotent within
 *  one active learning-assignment instance. */
export async function assignAdventureQuestion(params: {
  classId: string;
  notebookId: string;
  ref: QuestionRef;
  gameId?: string | null;
  dueAt?: string | null;
}): Promise<string> {
  const { classId, notebookId, ref } = params;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  if (!ref.sectionId) throw new Error("no_question");

  const { assignment } = await ensureAssignment({
    classId,
    notebookId,
    gameId: params.gameId ?? null,
    mode: "adventure",
    questionKeys: [ref.questionKey],
    dueAt: params.dueAt ?? null,
  });

  const existing = await findAdventureRow(classId, notebookId, ref);
  if (existing) {
    await supabase
      .from("class_adventure_notes")
      .update({
        unassigned_at: null,
        section_id: ref.sectionId,
        question_key: ref.questionKey,
        assigned_by: uid,
        assignment_id: assignment.id,
        ...(params.dueAt !== undefined ? { due_at: params.dueAt } : {}),
      } as never)
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("class_adventure_notes")
    .insert({
      class_id: classId,
      notebook_id: notebookId,
      section_id: ref.sectionId,
      question_key: ref.questionKey,
      due_at: params.dueAt ?? null,
      assigned_by: uid,
      assignment_id: assignment.id,
    } as never)
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "adventure_assign_failed");
  return (created as any).id as string;
}

/** Soft-remove: the card leaves every dashboard, student progress survives.
 *  When the row belongs to a learning-assignment instance whose last active
 *  question this was, the whole instance is archived (read-only history). */
export async function unassignAdventureQuestion(id: string): Promise<void> {
  const { data: row } = await supabase
    .from("class_adventure_notes")
    .select("id, assignment_id")
    .eq("id", id)
    .maybeSingle();
  await supabase
    .from("class_adventure_notes")
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("id", id);
  await archiveIfEmpty((row as any)?.assignment_id ?? null, "class_adventure_notes");
}

/** Archive the parent instance once none of its questions are active. */
async function archiveIfEmpty(
  assignmentId: string | null,
  childTable: "class_adventure_notes" | "assessments",
): Promise<void> {
  if (!assignmentId) return;
  const { data } = await (supabase.from(childTable) as any)
    .select("id")
    .eq("assignment_id", assignmentId)
    .is("unassigned_at", null)
    .limit(1);
  if (((data ?? []) as any[]).length === 0) {
    await archiveAssignment(assignmentId, "teacher");
  }
}


/** Assign (or revive) a question to a class as an Assignment. Idempotent. */
export async function assignAssessmentQuestion(params: {
  classId: string;
  notebookId: string;
  ref: QuestionRef;
  kind: AssessmentKind;
  title: string;
  scoreLabel: string;
}): Promise<string> {
  const { classId, notebookId, ref } = params;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  if (!ref.sectionId) throw new Error("no_question");

  const { questions, answerKey, total } = await compileSectionQuestions(ref.sectionId);
  if (questions.length === 0) throw new Error("no_floating_lines");

  const { data } = await supabase
    .from("assessments")
    .select("id, section_id, question_key, created_at")
    .eq("class_id", classId)
    .eq("notebook_id", notebookId)
    .neq("kind", "adventure")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as any[];
  const hit =
    (ref.questionKey && rows.find((r) => r.question_key === ref.questionKey)) ||
    (ref.sectionId && rows.find((r) => !r.question_key && r.section_id === ref.sectionId));

  if (hit) {
    await supabase
      .from("assessments")
      .update({
        unassigned_at: null,
        section_id: ref.sectionId,
        question_key: ref.questionKey,
        kind: params.kind,
        title: params.title,
        score_label: params.scoreLabel,
        total_marks: total,
        questions: questions as never,
      } as never)
      .eq("id", hit.id);
    await supabase.from("assessment_answer_keys").delete().eq("assessment_id", hit.id);
    await supabase
      .from("assessment_answer_keys")
      .insert({ assessment_id: hit.id, lines: answerKey as never } as never);
    return hit.id as string;
  }

  const { data: created, error } = await supabase
    .from("assessments")
    .insert({
      class_id: classId,
      owner_id: uid,
      notebook_id: notebookId,
      section_id: ref.sectionId,
      question_key: ref.questionKey,
      kind: params.kind,
      title: params.title,
      score_label: params.scoreLabel,
      total_marks: total,
      questions: questions as never,
    } as never)
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "create_failed");

  const { error: keyErr } = await supabase
    .from("assessment_answer_keys")
    .insert({ assessment_id: (created as any).id, lines: answerKey as never } as never);
  if (keyErr) {
    await supabase.from("assessments").delete().eq("id", (created as any).id);
    throw new Error(keyErr.message);
  }
  return (created as any).id as string;
}

/** Soft-remove an Assignment. Progress rows are kept. */
export async function unassignAssessmentQuestion(id: string): Promise<void> {
  await supabase
    .from("assessments")
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("id", id);
}

/** Recompile every progress-bar board of a class/notebook IN PLACE from the
 *  questions that are currently assigned. Never creates a second assessment,
 *  so re-linking or editing the note can't duplicate questions. */
export async function syncAdventureBoards(classId: string, notebookId: string): Promise<void> {
  const { data: boards } = await supabase
    .from("class_game_boards")
    .select("id, assessment_id, question_keys")
    .eq("class_id", classId)
    .eq("notebook_id", notebookId);
  const list = (boards ?? []) as any[];
  if (list.length === 0) return;

  const { data: activeNotes } = await supabase
    .from("class_adventure_notes")
    .select("section_id, question_key")
    .eq("class_id", classId)
    .eq("notebook_id", notebookId)
    .is("unassigned_at", null);
  const notes = (activeNotes ?? []) as any[];

  for (const b of list) {
    const keys: string[] = Array.isArray(b.question_keys) ? b.question_keys : [];
    const scoped = keys.length
      ? notes.filter((n) => n.question_key && keys.includes(n.question_key))
      : notes;
    const sectionIds = scoped.map((n) => n.section_id).filter(Boolean) as string[];
    const compiled = await compileQuestionSections(sectionIds);

    await supabase
      .from("assessments")
      .update({
        total_marks: compiled.total,
        questions: compiled.questions as never,
      } as never)
      .eq("id", b.assessment_id);
    await supabase.from("assessment_answer_keys").delete().eq("assessment_id", b.assessment_id);
    if (compiled.answerKey.length) {
      await supabase
        .from("assessment_answer_keys")
        .insert({ assessment_id: b.assessment_id, lines: compiled.answerKey as never } as never);
    }
    await supabase
      .from("class_game_boards")
      .update({ required_marks: compiled.total } as never)
      .eq("id", b.id);
  }
}
