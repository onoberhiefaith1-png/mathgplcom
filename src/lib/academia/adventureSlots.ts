// Academia Adventure data: questions per learning point (copied at assign time,
// so the lesson note can change or disappear), pass marks, and the chosen Game.
import { supabase } from "@/integrations/supabase/client";
import { blockQuestionObjects } from "@/lib/assessments/questionObjects";
import { compileOfflineBoard } from "@/lib/offline/academiaPack";
import type { GameQuestionBoard } from "@/lib/slate/gameBoard";
import type { SolutionObject } from "@/lib/floating/solutionItems";
import { linesForQuestion, passPctOf } from "./adventurePlay";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type AdventureQuestion = {
  id: string;
  activityId: string;
  sceneId: string;
  barId: string;
  position: number;
  title: string;
  questionText: string | null;
  lines: unknown[];
  objects: SolutionObject[] | null;
  totalMarks: number;
  subsectionId: string | null;
  notebookId: string | null;
};

const toQ = (r: any): AdventureQuestion => ({
  id: r.id, activityId: r.activity_id, sceneId: r.scene_id, barId: r.bar_id, position: r.position ?? 0,
  title: r.title ?? "", questionText: r.question_text ?? null, lines: r.lines ?? [], objects: r.objects ?? null,
  totalMarks: Number(r.total_marks) || 0, subsectionId: r.subsection_id ?? null, notebookId: r.notebook_id ?? null,
});

export async function listAdventureQuestions(activityId: string): Promise<AdventureQuestion[]> {
  const { data, error } = await db.from("academia_adventure_questions").select("*").eq("activity_id", activityId).order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toQ);
}

export async function listPassMarks(activityId: string): Promise<Record<string, number>> {
  const { data } = await db.from("academia_adventure_points").select("scene_id, pass_pct").eq("activity_id", activityId);
  return Object.fromEntries(((data ?? []) as any[]).map((r) => [r.scene_id, passPctOf(r.pass_pct)]));
}

export async function setPassMark(activityId: string, sceneId: string, pct: number) {
  const { error } = await db.from("academia_adventure_points").upsert(
    { activity_id: activityId, scene_id: sceneId, pass_pct: passPctOf(pct), updated_at: new Date().toISOString() },
    { onConflict: "activity_id,scene_id" },
  );
  if (error) throw new Error(error.message);
}

/** Copy one lesson-note question onto one learning point. */
export async function assignToLearningPoint(input: {
  activityId: string; sceneId: string; barId: string; notebookId: string; subsectionId: string | null; title: string;
}) {
  if (!input.subsectionId) throw new Error("Choose a question first.");
  const { data: sub } = await db.from("notebook_subsections").select("section_id, floating_lines").eq("id", input.subsectionId).maybeSingle();
  if (!sub) throw new Error("This question has no saved content yet.");
  const { data: sec } = await db.from("notebook_sections").select("stable_key").eq("id", sub.section_id).maybeSingle();
  const questionKey = (sec?.stable_key as string) ?? null;
  const lines = linesForQuestion(sub.floating_lines, questionKey);
  if (lines.length < 2) throw new Error("Add Floating Numbers to this question before assigning it.");
  const { data: blocks } = await db.from("notebook_blocks").select("kind, content_ascii, content_json, order_index").eq("subsection_id", input.subsectionId).order("order_index");
  let questionText: string | null = null;
  const objects: SolutionObject[] = [];
  for (const b of (blocks ?? []) as any[]) {
    if (b.kind === "problem" && questionText == null) questionText = String(b.content_ascii ?? "") || null;
    if (b.kind !== "problem" && b.kind !== "solution") continue;
    for (const o of blockQuestionObjects(b.content_json)) objects.push(b.kind === "solution" ? { ...o, inSolution: true } as SolutionObject : o);
  }
  const existing = await listAdventureQuestions(input.activityId);
  const position = existing.filter((q) => q.sceneId === input.sceneId).reduce((m, q) => Math.max(m, q.position + 1), 0);
  const { data: u } = await supabase.auth.getUser();
  const board = compileOfflineBoard({ activityId: "x", subsectionId: input.subsectionId, title: input.title, lines: lines as never, questionText, objects });
  const { error } = await db.from("academia_adventure_questions").insert({
    activity_id: input.activityId, scene_id: input.sceneId, bar_id: input.barId, position,
    title: input.title, question_text: questionText, lines, objects: objects.length ? objects : null,
    total_marks: board?.totalMarks ?? 0, notebook_id: input.notebookId, subsection_id: input.subsectionId,
    question_key: questionKey, created_by: u.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeAdventureQuestion(id: string) {
  const { error } = await db.from("academia_adventure_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveOrder(ids: string[]) {
  await Promise.all(ids.map((id, position) => db.from("academia_adventure_questions").update({ position }).eq("id", id)));
}

/** The Game whose writing surfaces play over this Session's Adventure. */
export async function setAdventureGame(activityId: string, gameId: string | null) {
  const { data: act } = await db.from("academia_activities").select("class_id").eq("id", activityId).maybeSingle();
  if (gameId && act?.class_id) {
    const { assignGameToClass } = await import("@/lib/slate/gameAssignments");
    await assignGameToClass({ gameId, classId: act.class_id, passPercentage: 100 }).catch(() => undefined);
  }
  const { error } = await db.from("academia_activities").update({ game_id: gameId }).eq("id", activityId);
  if (error) throw new Error(error.message);
}

/** Compile one saved question into the Game's question board. */
export function boardFor(q: AdventureQuestion): GameQuestionBoard | null {
  const board = compileOfflineBoard({
    activityId: q.id, subsectionId: q.subsectionId ?? q.id, notebookId: q.notebookId, title: q.title,
    lines: q.lines as never, questionText: q.questionText, objects: q.objects,
  });
  return board ? { ...board, questionRowId: q.id } : null;
}
