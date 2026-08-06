// One Progress Bar → one Lesson Note. This module is the single source of
// truth for which bars of an adventure are already occupied, so the Link
// dialog and the Adventures page can never disagree.
import { supabase } from "@/integrations/supabase/client";
import {
  adventureModeOf,
  checkpointsOf,
  isVideoAdventure,
  questionBarsOf,
  reservedTimeBarOf,
  sceneTimeSeconds,
  type CanvasElement,
  type GameCanvas,
  type Scene,
} from "@/lib/games/types";

export type BarAssignment = {
  boardId: string;
  assessmentId: string;
  notebookId: string;
  notebookTitle: string;
  questionCount: number;
};

export const BAR_OCCUPIED_MESSAGE =
  "This Progress Bar already has a Lesson Note assigned. Please unassign the current Lesson Note before linking a new one.";

/** Assignments keyed by progress bar element id, for one class + game. */
export async function loadBarAssignments(
  classId: string,
  gameId: string,
): Promise<Record<string, BarAssignment>> {
  const { data: boards } = await supabase
    .from("class_game_boards")
    .select("id, assessment_id, progress_element_id, notebook_id, question_keys")
    .eq("class_id", classId)
    .eq("game_id", gameId);
  const rows = (boards ?? []) as any[];
  if (rows.length === 0) return {};

  const notebookIds = Array.from(new Set(rows.map((r) => r.notebook_id).filter(Boolean)));
  const { data: notebooks } = notebookIds.length
    ? await supabase.from("notebooks").select("id, title").in("id", notebookIds)
    : { data: [] as any[] };
  const titles = new Map<string, string>(
    ((notebooks ?? []) as any[]).map((n) => [n.id as string, (n.title as string) || "Lesson Note"]),
  );

  const map: Record<string, BarAssignment> = {};
  for (const r of rows) {
    if (!r.progress_element_id) continue;
    const keys = Array.isArray(r.question_keys) ? r.question_keys : [];
    map[r.progress_element_id as string] = {
      boardId: r.id as string,
      assessmentId: r.assessment_id as string,
      notebookId: (r.notebook_id as string) ?? "",
      notebookTitle: titles.get(r.notebook_id as string) ?? "Lesson Note",
      questionCount: keys.length,
    };
  }
  return map;
}

/** Free a Progress Bar so another Lesson Note can be assigned to it. */
export async function unassignBar(a: Pick<BarAssignment, "boardId" | "assessmentId">): Promise<void> {
  if (a.assessmentId) await supabase.from("assessments").delete().eq("id", a.assessmentId);
  await supabase.from("class_game_boards").delete().eq("id", a.boardId);
}

/** "Learning Point 2" for a Video Adventure, "Scene 2" for a static one. */
export const checkpointLabel = (canvas: GameCanvas, scene: Scene, index: number): string => {
  const video = adventureModeOf(canvas) === "video";
  const noun = video ? "Learning Point" : "Scene";
  const title = (scene.title ?? "").trim();
  const generic = !title || /^checkpoint\s*\d+$/i.test(title) || /^scene\s*\d+$/i.test(title);
  return generic ? `${noun} ${index + 1}` : `${noun} ${index + 1} · ${title}`;
};
