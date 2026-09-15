// Game Play reuses the EXISTING Smartboard / Floating Numbers engine.
//
// A Game question is a Lesson Note question. To reach the student board it
// needs exactly what every other student board needs: a compiled question
// payload and its answer key. So the teacher's Game keeps one hidden
// `kind = 'game'` assessment per Game question, compiled by the SAME compiler
// the class assignment uses. Nothing here marks, renders or re-authors
// mathematics — the Game only points the board at the right question.

import { supabase } from "@/integrations/supabase/client";
import {
  compileSectionQuestions,
  type AnswerKeyLine,
  type QuestionPayload,
} from "@/lib/assessments/createAssessment";
import {
  buildAssessmentBoardSource,
  type AssessmentBoardSource,
} from "@/lib/assessments/assessmentBoardSource";
import { ensureTestClass } from "@/lib/floating/testBoard";
import { questionTimer, lineTimer, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import { listGameQuestions, type GameQuestion } from "./gameQuestions";

export const GAME_ASSESSMENT_KIND = "game";

export interface GameQuestionBoard {
  /** slate_game_questions row id. */
  questionRowId: string;
  subsectionId: string;
  notebookId: string;
  /** The hidden per-class assessment the student board reads. */
  assessmentId: string;
  /** The board's question id (canonical lesson beat id). */
  boardQuestionId: string;
  title: string;
  questionText: string;
  totalMarks: number;
  boardSource: AssessmentBoardSource;
  /** Seconds for the whole question, from Floating Numbers. Null = no timer. */
  questionTimerSeconds: number | null;
  /** Per-line time from Floating Numbers — this is what creates the hourglass. */
  lineTimers: (number | null)[];
  /** Board line ids in Game Line order (Game Line N = lineIds[N - 1]). */
  lineIds: string[];
  lineMarks: number[];
}

const beatIdFor = (subsectionId: string) => `${subsectionId}-q`;

const sourceFor = (assessmentId: string, title: string, question: QuestionPayload) =>
  buildAssessmentBoardSource({ id: assessmentId, title, questions: [question] });

const sectionOf = async (subsectionId: string): Promise<string | null> => {
  const { data } = await supabase
    .from("notebook_subsections")
    .select("section_id")
    .eq("id", subsectionId)
    .maybeSingle();
  return ((data as { section_id?: string } | null)?.section_id ?? null) as string | null;
};

/**
 * Teacher side. Compiles every Game question into a hidden class assessment so
 * the student board (and the teacher's own Play/Test sitting) can open it.
 * Idempotent: an existing row for the same question is refreshed in place, so
 * changes made in Floating Numbers reach the Game automatically.
 *
 * `classId` omitted → the teacher's private Floating-Number test class, which
 * is what Play from the Game Board uses.
 */
export const ensureGameBoards = async (params: {
  gameId: string;
  classId?: string | null;
  questions?: GameQuestion[];
}): Promise<GameQuestionBoard[]> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const questions = params.questions ?? (await listGameQuestions(params.gameId));
  if (questions.length === 0) return [];

  const classId = params.classId || (await ensureTestClass(uid));
  const out: GameQuestionBoard[] = [];

  for (const q of questions) {
    const sectionId = await sectionOf(q.subsectionId);
    if (!sectionId) continue;
    const compiled = await compileSectionQuestions(sectionId);
    const compiledQuestion = compiled.questions.find((row) => row.id === q.subsectionId);
    if (!compiledQuestion) continue;

    const boardQuestionId = beatIdFor(q.subsectionId);
    const question: QuestionPayload = { ...compiledQuestion, id: boardQuestionId };
    const answerKey: AnswerKeyLine[] = compiled.answerKey
      .filter((line) => line.questionId === q.subsectionId)
      .map((line) => ({ ...line, questionId: boardQuestionId }));
    const total = question.lines.reduce((sum, line) => sum + (Number(line.marks) || 0), 0);
    const title = q.questionText.slice(0, 60) || `Game question ${q.position + 1}`;

    const { data: existing } = await supabase
      .from("assessments")
      .select("id")
      .eq("class_id", classId)
      .eq("kind", GAME_ASSESSMENT_KIND)
      .eq("question_key", q.subsectionId)
      .maybeSingle();

    let assessmentId = (existing as { id?: string } | null)?.id ?? null;
    const payload = {
      notebook_id: q.notebookId,
      section_id: sectionId,
      title,
      total_marks: total,
      questions: [question] as never,
      // Kept out of every Assignment list: those all filter on unassigned_at.
      unassigned_at: new Date().toISOString(),
    };

    if (assessmentId) {
      await supabase.from("assessments").update(payload as never).eq("id", assessmentId);
    } else {
      const { data: created, error } = await supabase
        .from("assessments")
        .insert({
          class_id: classId,
          owner_id: uid,
          question_key: q.subsectionId,
          kind: GAME_ASSESSMENT_KIND,
          score_label: q.scoring.label || "Marks",
          ...payload,
        } as never)
        .select("id")
        .single();
      if (error || !created) continue;
      assessmentId = (created as { id: string }).id;
    }

    await supabase
      .from("assessment_answer_keys")
      .upsert({ assessment_id: assessmentId, lines: answerKey as never }, { onConflict: "assessment_id" });

    out.push({
      questionRowId: q.id,
      subsectionId: q.subsectionId,
      notebookId: q.notebookId,
      assessmentId,
      boardQuestionId,
      title,
      questionText: q.questionText,
      totalMarks: total,
      boardSource: sourceFor(assessmentId, title, question),
      questionTimerSeconds: questionTimer(q.scoring),
      lineTimers: (q.lines as FloatingLine[]).map((line) => lineTimer(line)),
      lineIds: question.lines.map((line) => line.lineId),
      lineMarks: question.lines.map((line) => Number(line.marks) || 0),
    });
  }

  return out;
};

/**
 * Student side. Reads the hidden Game assessments the teacher already built —
 * a student never compiles a lesson note.
 */
export const loadGameBoards = async (params: {
  gameId: string;
  classId: string;
}): Promise<GameQuestionBoard[]> => {
  const questions = await listGameQuestions(params.gameId);
  if (questions.length === 0) return [];

  const { data } = await supabase
    .from("assessments")
    .select("id, title, questions, question_key, score_label")
    .eq("class_id", params.classId)
    .eq("kind", GAME_ASSESSMENT_KIND)
    .in("question_key", questions.map((q) => q.subsectionId));

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string | null;
    questions: QuestionPayload[] | null;
    question_key: string;
  }[];
  const byKey = new Map(rows.map((row) => [row.question_key, row]));

  const out: GameQuestionBoard[] = [];
  for (const q of questions) {
    const row = byKey.get(q.subsectionId);
    const question = (row?.questions ?? [])[0];
    if (!row || !question) continue;
    const title = row.title ?? `Question ${q.position + 1}`;
    out.push({
      questionRowId: q.id,
      subsectionId: q.subsectionId,
      notebookId: q.notebookId,
      assessmentId: row.id,
      boardQuestionId: question.id,
      title,
      questionText: q.questionText,
      totalMarks: question.lines.reduce((sum, line) => sum + (Number(line.marks) || 0), 0),
      boardSource: sourceFor(row.id, title, question),
      questionTimerSeconds: questionTimer(q.scoring),
      lineTimers: (q.lines as FloatingLine[]).map((line) => lineTimer(line)),
      lineIds: question.lines.map((line) => line.lineId),
      lineMarks: question.lines.map((line) => Number(line.marks) || 0),
    });
  }
  return out;
};
