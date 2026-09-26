// ONE PROGRESS BAR → MANY QUESTIONS. A bar's card is keyed on
// (class + adventure + progress bar); the lesson notes the questions came from
// are only provenance. This module is the single source of truth for what each
// bar of one class adventure currently holds.
import { supabase } from "@/integrations/supabase/client";
import { listBarQuestions, type BarQuestion } from "./barQuestions";
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

export type BarCard = {
  boardId: string | null;
  assessmentId: string | null;
  questions: BarQuestion[];
  /** Lesson note titles feeding this bar, in first-assigned order. */
  noteTitles: string[];
  totalMarks: number;
  passPct: number | null;
};

/** What every progress bar of one class adventure currently holds. */
export async function loadBarCards(
  classId: string,
  gameId: string,
): Promise<Record<string, BarCard>> {
  const [byBar, { data: boards }] = await Promise.all([
    listBarQuestions(classId, gameId),
    supabase
      .from("class_game_boards")
      .select("id, assessment_id, progress_element_id, required_marks, pass_pct")
      .eq("class_id", classId)
      .eq("game_id", gameId),
  ]);

  const boardByBar = new Map<string, any>(
    ((boards ?? []) as any[]).map((b) => [b.progress_element_id as string, b]),
  );

  const notebookIds = Array.from(
    new Set(
      Object.values(byBar)
        .flat()
        .map((q) => q.notebookId)
        .filter(Boolean) as string[],
    ),
  );
  const { data: notebooks } = notebookIds.length
    ? await supabase.from("notebooks").select("id, title").in("id", notebookIds)
    : { data: [] as any[] };
  const titleById = new Map<string, string>(
    ((notebooks ?? []) as any[]).map((n) => [n.id as string, (n.title as string) || "Lesson Note"]),
  );

  const barIds = new Set<string>([...Object.keys(byBar), ...boardByBar.keys()]);
  const map: Record<string, BarCard> = {};
  for (const barId of barIds) {
    const questions = byBar[barId] ?? [];
    const board = boardByBar.get(barId);
    const noteTitles: string[] = [];
    for (const q of questions) {
      const t = q.notebookId ? titleById.get(q.notebookId) : null;
      if (t && !noteTitles.includes(t)) noteTitles.push(t);
    }
    map[barId] = {
      boardId: (board?.id as string) ?? null,
      assessmentId: (board?.assessment_id as string) ?? null,
      questions,
      noteTitles,
      totalMarks: Number(board?.required_marks ?? 0) || 0,
      passPct: board?.pass_pct == null ? null : Number(board.pass_pct),
    };
  }
  return map;
}

/** Take every question off one bar — the adventure link itself stays. */
export async function clearBar(classId: string, gameId: string, barId: string): Promise<void> {
  const { data: board } = await supabase
    .from("class_game_boards")
    .select("id, assessment_id")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("progress_element_id", barId)
    .maybeSingle();
  await supabase
    .from("adventure_bar_questions" as never)
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("class_id" as never, classId as never)
    .eq("game_id" as never, gameId as never)
    .eq("progress_element_id" as never, barId as never)
    .is("unassigned_at", null);
  const row = board as any | null;
  if (row?.assessment_id) {
    await supabase
      .from("assessments")
      .update({ unassigned_at: new Date().toISOString() } as never)
      .eq("id", row.assessment_id);
  }
  if (row?.id) await supabase.from("class_game_boards").delete().eq("id", row.id);
}

/** "Learning Point 2" for a Video Adventure, "Scene 2" for a static one. */
export const checkpointLabel = (canvas: GameCanvas, scene: Scene, index: number): string => {
  const video = adventureModeOf(canvas) === "video";
  const noun = video ? "Learning Point" : "Scene";
  const title = (scene.title ?? "").trim();
  const generic = !title || /^checkpoint\s*\d+$/i.test(title) || /^scene\s*\d+$/i.test(title);
  return generic ? `${noun} ${index + 1}` : `${noun} ${index + 1} · ${title}`;
};

/** One Learning Point (Video) / Scene (Static) and its linkable Progress Bars. */
export type LinkableBarGroup = {
  sceneId: string;
  label: string;
  /** The reserved Time Progress Bar of this Learning Point, if any. */
  timeBarId: string | null;
  /** Progress Bars that may receive a Lesson Note (Time Bar excluded). */
  bars: CanvasElement[];
  /** Whether a countdown duration is configured (publishing requirement). */
  hasTime: boolean;
};

/**
 * Walk EVERY Learning Point of an adventure and collect the Progress Bars that
 * can carry questions. Progress Bars live inside Learning Points, never at the
 * top level, so this is an ordered per-scene traversal:
 *
 *   Adventure → Learning Point n → [reserved Time Bar (skipped), ...bars]
 *
 * Video Adventures are walked in video play order; static ones in scene order.
 * Groups are returned even when they contribute no linkable bar, so the teacher
 * always sees the real structure instead of an empty panel.
 */
export function collectLinkableBars(canvas: GameCanvas): LinkableBarGroup[] {
  const all = canvas.scenes ?? [];
  const ordered: Scene[] = isVideoAdventure(canvas)
    ? (() => {
        const cps = checkpointsOf(canvas);
        const rest = all.filter((s) => !cps.some((c) => c.id === s.id));
        return [...cps, ...rest];
      })()
    : all;

  return ordered.map((scene, index) => {
    const els = scene.elements ?? [];
    return {
      sceneId: scene.id,
      label: checkpointLabel(canvas, scene, index),
      timeBarId: reservedTimeBarOf(els)?.id ?? null,
      bars: questionBarsOf(els),
      hasTime: sceneTimeSeconds(scene) > 0,
    };
  });
}
