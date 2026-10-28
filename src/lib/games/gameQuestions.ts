// Game questions authoring + compilation.

import { supabase } from "@/integrations/supabase/client";
import { compileSectionQuestions } from "@/lib/assessments/createAssessment";
import { normalizeCanvas, type CanvasElement, type GameRow } from "./types";

const seedDocument = () => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Game Questions" }] },
    { type: "paragraph" },
  ],
});

export async function ensureGameQuestionNotebook(
  game: Pick<GameRow, "id" | "title" | "subtopic" | "topic">,
  existingNotebookId?: string,
): Promise<string> {
  if (existingNotebookId) {
    const { data } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", existingNotebookId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const contextSubtopic = [game.topic, game.subtopic]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" — ");

  const { data, error } = await supabase
    .from("notebooks")
    .insert({
      owner_id: uid,
      subject: "Mathematics",
      title: game.title || "Game",
      subtopic: contextSubtopic,
      session: "Game Question",
      color_index: 0,
      document_json: seedDocument() as never,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "notebook_create_failed");
  return (data as { id: string }).id;
}

export function progressBarsWithQuestions(game: GameRow): CanvasElement[] {
  const canvas = normalizeCanvas(game.canvas);
  const bars: CanvasElement[] = [];
  for (const scene of canvas.scenes) {
    for (const el of scene.elements) {
      if (el.kind === "progress_bar" && el.progress?.questionNotebookId) bars.push(el);
    }
  }
  return bars;
}

async function firstSectionId(notebookId: string): Promise<string | null> {
  const { data } = await supabase
    .from("notebook_sections")
    .select("id, order_index")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true })
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

export async function sharedScoreForAssessments(
  assessmentIds: string[],
): Promise<number> {
  if (assessmentIds.length === 0) return 0;
  const { data } = await supabase
    .from("assessment_progress")
    .select("score")
    .in("assessment_id", assessmentIds);
  return (data ?? []).reduce((a, r: any) => a + (Number(r.score) || 0), 0);
}

export interface GameBoard {
  progressElementId: string;
  assessmentId: string;
  title: string;
  totalMarks: number;
  questions: { id: string; questionText: string; lines: { lineId: string; marks: number }[] }[];
}

export async function ensureClassGameBoards(
  game: GameRow,
  classId: string,
): Promise<GameBoard[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const bars = progressBarsWithQuestions(game);

  const { data: existing } = await supabase
    .from("class_game_boards")
    .select("progress_element_id, assessment_id")
    .eq("class_id", classId)
    .eq("game_id", game.id);
  const haveByElement = new Map<string, string>(
    (existing ?? []).map((r: any) => [r.progress_element_id, r.assessment_id]),
  );

  for (const bar of bars) {
    if (haveByElement.has(bar.id)) continue;
    const notebookId = bar.progress!.questionNotebookId!;
    const sectionId = await firstSectionId(notebookId);
    if (!sectionId) continue;
    const { questions, answerKey, total } = await compileSectionQuestions(sectionId);
    if (questions.length === 0) continue;

    const target = total;
    const { data: created, error: insErr } = await supabase
      .from("assessments")
      .insert({
        class_id: classId,
        owner_id: uid,
        notebook_id: notebookId,
        section_id: sectionId,
        kind: "assessment",
        title: `${game.title} — ${bar.label || "Progress Bar"}`,
        score_label: "Marks",
        total_marks: target,
        questions: questions as any,
      })
      .select("id")
      .single();
    if (insErr || !created) continue;

    const { error: keyErr } = await supabase
      .from("assessment_answer_keys")
      .insert({ assessment_id: created.id, lines: answerKey as any });
    if (keyErr) {
      await supabase.from("assessments").delete().eq("id", created.id);
      continue;
    }

    await supabase.from("class_game_boards").insert({
      class_id: classId,
      game_id: game.id,
      progress_element_id: bar.id,
      assessment_id: created.id,
    } as never);
    haveByElement.set(bar.id, created.id);
  }

  return loadClassGameBoards(game.id, classId);
}

export async function loadClassGameBoards(
  gameId: string,
  classId: string,
): Promise<GameBoard[]> {
  const { data: rows } = await supabase
    .from("class_game_boards")
    .select("progress_element_id, assessment_id")
    .eq("class_id", classId)
    .eq("game_id", gameId);
  const ids = (rows ?? []).map((r: any) => r.assessment_id as string);
  if (ids.length === 0) return [];

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, total_marks, questions, unassigned_at")
    .in("id", ids)
    .is("unassigned_at", null);
  const byId = new Map<string, any>((assessments ?? []).map((a: any) => [a.id, a]));

  return (rows ?? [])
    .map((r: any) => {
      const a = byId.get(r.assessment_id);
      if (!a) return null;
      return {
        progressElementId: r.progress_element_id,
        assessmentId: r.assessment_id,
        title: a.title ?? "Questions",
        totalMarks: Number(a.total_marks ?? 0),
        questions: (a.questions ?? []) as GameBoard["questions"],
      } as GameBoard;
    })
    .filter(Boolean) as GameBoard[];
}
