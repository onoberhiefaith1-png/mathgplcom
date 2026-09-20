// QUESTIONS ON A PROGRESS BAR.
//
// The grouping key of an adventure card is:
//
//     CLASS  +  ADVENTURE  +  PROGRESS BAR
//
// NOT the lesson note the questions came from. One bar may collect questions
// from several lesson notes, one lesson note may feed several bars, and the
// same question may sit on more than one bar (each scored independently).
//
// Every placement is a row in `adventure_bar_questions`. The bar's own
// assessment row (one per bar) is recompiled in place from its active
// placements, so a bar card can never be duplicated.

import { supabase } from "@/integrations/supabase/client";
import { compileQuestionSections } from "@/lib/assessments/createAssessment";

export interface BarQuestion {
  id: string;
  classId: string;
  gameId: string;
  barId: string;
  notebookId: string | null;
  sectionId: string | null;
  questionKey: string | null;
  createdAt: string;
}

const rowToQuestion = (r: any): BarQuestion => ({
  id: r.id as string,
  classId: r.class_id as string,
  gameId: r.game_id as string,
  barId: r.progress_element_id as string,
  notebookId: (r.notebook_id as string) ?? null,
  sectionId: (r.section_id as string) ?? null,
  questionKey: (r.question_key as string) ?? null,
  createdAt: r.created_at as string,
});

const SELECT =
  "id, class_id, game_id, progress_element_id, notebook_id, section_id, question_key, created_at";

/** Every active placement of one class adventure, keyed by progress bar id. */
export async function listBarQuestions(
  classId: string,
  gameId: string,
): Promise<Record<string, BarQuestion[]>> {
  const { data, error } = await supabase
    .from("adventure_bar_questions" as never)
    .select(SELECT)
    .eq("class_id" as never, classId as never)
    .eq("game_id" as never, gameId as never)
    .is("unassigned_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, BarQuestion[]> = {};
  for (const row of (data ?? []) as any[]) {
    const q = rowToQuestion(row);
    (map[q.barId] ??= []).push(q);
  }
  return map;
}

/** Where this exact question currently sits, across every class adventure. */
export async function listPlacementsForQuestion(params: {
  notebookId: string;
  questionKey: string | null;
  sectionId: string | null;
}): Promise<BarQuestion[]> {
  const { notebookId, questionKey, sectionId } = params;
  if (!notebookId || (!questionKey && !sectionId)) return [];
  const { data, error } = await supabase
    .from("adventure_bar_questions" as never)
    .select(SELECT)
    .eq("notebook_id" as never, notebookId as never)
    .is("unassigned_at", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .map(rowToQuestion)
    .filter((q) =>
      questionKey ? q.questionKey === questionKey : !q.questionKey && q.sectionId === sectionId,
    );
}

/** Place one question on one progress bar of one class adventure. Idempotent. */
export async function assignQuestionToBar(params: {
  classId: string;
  gameId: string;
  barId: string;
  notebookId: string;
  sectionId: string;
  questionKey: string | null;
  barLabel?: string;
  adventureTitle?: string;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  if (!params.sectionId) throw new Error("no_question");

  const { data: link, error: linkError } = await supabase
    .from("class_adventures" as never)
    .select("id")
    .eq("class_id" as never, params.classId as never)
    .eq("game_id" as never, params.gameId as never)
    .is("unlinked_at", null)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (!link) throw new Error("adventure_not_linked");

  const existing = await findPlacement(params);
  if (existing) {
    const { error } = await supabase
      .from("adventure_bar_questions" as never)
      .update({
        unassigned_at: null,
        section_id: params.sectionId,
        notebook_id: params.notebookId,
        assigned_by: uid,
      } as never)
      .eq("id" as never, existing.id as never);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("adventure_bar_questions" as never).insert({
      class_id: params.classId,
      game_id: params.gameId,
      progress_element_id: params.barId,
      notebook_id: params.notebookId,
      section_id: params.sectionId,
      question_key: params.questionKey,
      assigned_by: uid,
    } as never);
    if (error) throw new Error(error.message);
  }

  await syncBarBoard({
    classId: params.classId,
    gameId: params.gameId,
    barId: params.barId,
    barLabel: params.barLabel,
    adventureTitle: params.adventureTitle,
  });
}

/** Take one question off one bar. Other bars and other classes are untouched. */
export async function removeQuestionFromBar(params: {
  classId: string;
  gameId: string;
  barId: string;
  notebookId: string;
  questionKey: string | null;
  sectionId: string | null;
}): Promise<void> {
  const hit = await findPlacement({
    classId: params.classId,
    gameId: params.gameId,
    barId: params.barId,
    notebookId: params.notebookId,
    questionKey: params.questionKey,
    sectionId: params.sectionId ?? "",
  });
  if (hit) {
    const { error } = await supabase
      .from("adventure_bar_questions" as never)
      .update({ unassigned_at: new Date().toISOString() } as never)
      .eq("id" as never, hit.id as never);
    if (error) throw new Error(error.message);
  }
  await syncBarBoard({ classId: params.classId, gameId: params.gameId, barId: params.barId });
}

async function findPlacement(params: {
  classId: string;
  gameId: string;
  barId: string;
  notebookId: string;
  questionKey: string | null;
  sectionId: string;
}): Promise<BarQuestion | null> {
  const { data, error } = await supabase
    .from("adventure_bar_questions" as never)
    .select(SELECT)
    .eq("class_id" as never, params.classId as never)
    .eq("game_id" as never, params.gameId as never)
    .eq("progress_element_id" as never, params.barId as never)
    .eq("notebook_id" as never, params.notebookId as never);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as any[]).map(rowToQuestion);
  const hit = params.questionKey
    ? rows.find((r) => r.questionKey === params.questionKey)
    : rows.find((r) => !r.questionKey && r.sectionId === params.sectionId);
  return hit ?? null;
}

/**
 * Recompile ONE bar's card from the questions currently placed on it.
 * The bar owns exactly one assessment row, updated in place. When the last
 * question leaves the bar, the card and its board row are removed.
 */
export async function syncBarBoard(params: {
  classId: string;
  gameId: string;
  barId: string;
  barLabel?: string;
  adventureTitle?: string;
  passPct?: number | null;
}): Promise<void> {
  const { classId, gameId, barId } = params;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const byBar = await listBarQuestions(classId, gameId);
  const placements = byBar[barId] ?? [];
  const sectionIds = placements.map((p) => p.sectionId).filter(Boolean) as string[];

  const { data: existing, error: boardReadError } = await supabase
    .from("class_game_boards")
    .select("id, assessment_id, pass_pct")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", barId)
    .maybeSingle();
  if (boardReadError) throw new Error(boardReadError.message);
  const board = existing as any | null;

  // Empty bar → no card at all.
  if (sectionIds.length === 0) {
    if (board?.assessment_id) {
      const { error } = await supabase
        .from("assessments")
        .update({ unassigned_at: new Date().toISOString() } as never)
        .eq("id", board.assessment_id);
      if (error) throw new Error(error.message);
    }
    if (board?.id) {
      const { error } = await supabase.from("class_game_boards").delete().eq("id", board.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const compiled = await compileQuestionSections(sectionIds);
  if (compiled.questions.length === 0) throw new Error("no_questions");

  const notebookIds = Array.from(new Set(placements.map((p) => p.notebookId).filter(Boolean)));
  const questionKeys = placements.map((p) => p.questionKey).filter(Boolean) as string[];
  const label = params.barLabel || "Progress Bar";
  const title = `${params.adventureTitle ?? "Adventure"} — ${label}`;
  const passPct = params.passPct ?? (board?.pass_pct as number | null) ?? null;

  // The bar card itself IS the session: it is keyed on
  // (class + adventure + progress bar) and may mix lesson notes, so it never
  // belongs to a note-keyed learning-assignment row.

  let assessmentId = board?.assessment_id as string | undefined;
  if (assessmentId) {
    const { error } = await supabase
      .from("assessments")
      .update({
        // A bar can mix lesson notes, so it is not owned by one note.
        notebook_id: notebookIds.length === 1 ? notebookIds[0] : null,
        section_id: null,
        title,
        total_marks: compiled.total,
        questions: compiled.questions as never,
        unassigned_at: null,
      } as never)
      .eq("id", assessmentId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("assessments")
      .insert({
        class_id: classId,
        owner_id: uid,
        notebook_id: notebookIds.length === 1 ? notebookIds[0] : null,
        section_id: null,
        kind: "adventure" as never,
        title,
        score_label: "Marks",
        total_marks: compiled.total,
        questions: compiled.questions as never,
      } as never)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "create_failed");
    assessmentId = (created as any).id as string;
  }

  const { error: keyDeleteError } = await supabase
    .from("assessment_answer_keys")
    .delete()
    .eq("assessment_id", assessmentId);
  if (keyDeleteError) throw new Error(keyDeleteError.message);
  if (compiled.answerKey.length) {
    const { error } = await supabase
      .from("assessment_answer_keys")
      .insert({ assessment_id: assessmentId, lines: compiled.answerKey as never } as never);
    if (error) throw new Error(error.message);
  }

  const boardPayload = {
    class_id: classId,
    game_id: gameId,
    progress_element_id: barId,
    assessment_id: assessmentId,
    notebook_id: notebookIds.length === 1 ? notebookIds[0] : null,
    section_id: null,
    question_keys: questionKeys as never,
    required_marks: compiled.total,
    pass_pct: passPct,
  };
  if (board?.id) {
    const { error } = await supabase.from("class_game_boards").update(boardPayload as never).eq("id", board.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("class_game_boards").insert(boardPayload as never);
    if (error) throw new Error(error.message);
  }
}

/** The pass percentage of one bar. */
export async function setBarPassPct(
  classId: string,
  gameId: string,
  barId: string,
  passPct: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("class_game_boards")
    .update({ pass_pct: passPct } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", barId);
  if (error) throw new Error(error.message);
}
