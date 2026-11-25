/**
 * Play says a question is "not ready" when this filter is empty.
 * Assign-with-game avoids that by writing the class question and compiling
 * its board before the student arrives. Add/Change Game must do the same.
 */
import { assignGameToClass } from "@/lib/slate/gameAssignments";
import { assignQuestion } from "@/lib/slate/gameQuestions";
import { ensureGameBoards, type GameQuestionBoard } from "@/lib/slate/gameBoard";
import { supabase } from "@/integrations/supabase/client";

export const QUESTION_NOT_READY =
  "This question is not ready in the Game yet. Ask the teacher to assign it again.";

export function boardsForActivity<T extends { subsectionId: string }>(
  boards: readonly T[],
  subsectionId: string | null | undefined,
): T[] {
  if (!subsectionId) return boards.slice(0, 1);
  return boards.filter((board) => board.subsectionId === subsectionId);
}

export type PlayActivity = {
  id: string;
  kind: string;
  classId: string | null;
  subsectionId: string | null;
  notebookId: string | null;
  gameId: string | null;
};

export type PrepareQuestionDeps = {
  loadActivity: (activityId: string) => Promise<PlayActivity | null>;
  assignGameToClass: (gameId: string, classId: string) => Promise<void>;
  assignQuestion: (
    gameId: string,
    notebookId: string,
    subsectionId: string,
    classId: string,
  ) => Promise<boolean>;
  ensureGameBoards: (
    gameId: string,
    classId: string,
  ) => Promise<{ subsectionId: string }[]>;
};

/**
 * The same three steps as Assign with a game: class assignment, question row,
 * compiled board. Safe to call again for a question that was linked already.
 */
export async function prepareAcademiaQuestionGame<T extends { subsectionId: string }>(
  activityId: string,
  gameId: string,
  deps: PrepareQuestionDeps & { ensureGameBoards: (gameId: string, classId: string) => Promise<T[]> },
): Promise<T[]> {
  const activity = await deps.loadActivity(activityId);
  if (!activity || activity.kind !== "question" || !gameId) {
    throw new Error(QUESTION_NOT_READY);
  }
  if (!activity.classId || !activity.subsectionId || !activity.notebookId) {
    throw new Error(QUESTION_NOT_READY);
  }
  await deps.assignGameToClass(gameId, activity.classId);
  const joined = await deps.assignQuestion(
    gameId,
    activity.notebookId,
    activity.subsectionId,
    activity.classId,
  );
  if (!joined) throw new Error("This question could not be added to the Game.");
  const boards = await deps.ensureGameBoards(gameId, activity.classId);
  const ready = boardsForActivity(boards, activity.subsectionId);
  if (ready.length === 0) throw new Error(QUESTION_NOT_READY);
  return ready;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function loadPlayActivity(activityId: string): Promise<PlayActivity | null> {
  const { data, error } = await db
    .from("academia_activities")
    .select("id, kind, class_id, subsection_id, ref_id, game_id")
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    kind: string;
    class_id?: string | null;
    subsection_id?: string | null;
    ref_id?: string | null;
    game_id?: string | null;
  };
  return {
    id: row.id,
    kind: row.kind,
    classId: row.class_id ?? null,
    subsectionId: row.subsection_id ?? null,
    notebookId: row.ref_id ?? null,
    gameId: row.game_id ?? null,
  };
}

/** Live repair used when saving a game and when Play finds no board. */
export function repairAcademiaPlay(input: {
  activityId: string;
  gameId: string;
}): Promise<GameQuestionBoard[]> {
  return prepareAcademiaQuestionGame(input.activityId, input.gameId, {
    loadActivity: loadPlayActivity,
    assignGameToClass: async (gameId, classId) => {
      await assignGameToClass({ gameId, classId, passPercentage: 100 });
    },
    assignQuestion: (gameId, notebookId, subsectionId, classId) =>
      assignQuestion(gameId, notebookId, subsectionId, classId),
    ensureGameBoards: (gameId, classId) =>
      ensureGameBoards({ gameId, classId, questionClassId: classId }),
  });
}
