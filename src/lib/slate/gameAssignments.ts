// A Game is given to a class as its own assignment type. The Game stays the
// container: its questions, marks and timing are read live from Floating
// Numbers, never copied here.
//
// CLASS + GAME = ONE PLAYABLE GAME. This row IS that instance: its questions,
// their order, its play settings and every student's progress hang off it.

import { db } from "@/lib/db/scope";
import { listGameQuestions, type GameQuestion } from "./gameQuestions";

export type LevelMapStyle = "path" | "art";

export interface GameAssignment {
  id: string;
  gameId: string;
  classId: string;
  passPercentage: number;
  title: string | null;
  active: boolean;
  /** Level N unlocks only when Level N-1 is complete. */
  lockProgression: boolean;
  /** 1–5, default 3. */
  startingLives: number;
  levelMapStyle: LevelMapStyle;
}

const SELECT =
  "id, game_id, class_id, pass_percentage, title, unassigned_at, lock_progression, starting_lives, level_map_style";

type Row = {
  id: string;
  game_id: string;
  class_id: string;
  pass_percentage: number;
  title: string | null;
  unassigned_at: string | null;
  lock_progression?: boolean | null;
  starting_lives?: number | null;
  level_map_style?: string | null;
};

export const clampStartingLives = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
};

const asRow = (row: Row): GameAssignment => ({
  id: row.id,
  gameId: row.game_id,
  classId: row.class_id,
  passPercentage: Number(row.pass_percentage ?? 70),
  title: row.title,
  active: !row.unassigned_at,
  lockProgression: Boolean(row.lock_progression),
  startingLives: clampStartingLives(row.starting_lives ?? 3),
  levelMapStyle: row.level_map_style === "art" ? "art" : "path",
});

/** Saves the play settings of ONE playable instance (Class + Game). */
export const updateGameInstanceSettings = async (
  assignmentId: string,
  patch: Partial<Pick<GameAssignment, "lockProgression" | "startingLives" | "levelMapStyle">>,
): Promise<void> => {
  const payload: Record<string, unknown> = {};
  if (patch.lockProgression !== undefined) payload.lock_progression = patch.lockProgression;
  if (patch.startingLives !== undefined) payload.starting_lives = clampStartingLives(patch.startingLives);
  if (patch.levelMapStyle !== undefined) payload.level_map_style = patch.levelMapStyle;
  if (Object.keys(payload).length === 0) return;
  await db().from("slate_game_assignments").update(payload as never).eq("id", assignmentId);
};

export interface GameClassOption {
  assignmentId: string;
  classId: string;
  className: string;
}

/** The classes this Game is linked to — the Select Class list before Play. */
export const listGameClasses = async (gameId: string): Promise<GameClassOption[]> => {
  if (!gameId) return [];
  const { data } = await db()
    .from("slate_game_assignments")
    .select("id, class_id, classes(name)")
    .eq("game_id", gameId)
    .is("unassigned_at", null)
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as {
    id: string;
    class_id: string;
    classes: { name: string } | null;
  }[]).map((row) => ({
    assignmentId: row.id,
    classId: row.class_id,
    className: row.classes?.name ?? "Class",
  }));
};

/** Active game assignments per class for one Game. */
export const loadGameAssignmentState = async (
  gameId: string,
): Promise<Map<string, GameAssignment>> => {
  const byClass = new Map<string, GameAssignment>();
  if (!gameId) return byClass;
  const { data } = await db()
    .from("slate_game_assignments")
    .select(SELECT)
    .eq("game_id", gameId)
    .is("unassigned_at", null);
  ((data ?? []) as unknown as Row[]).forEach((row) => {
    byClass.set(row.class_id, asRow(row));
  });
  return byClass;
};

/** Gives the Game to a class (idempotent — revives a previous row). */
export const assignGameToClass = async (params: {
  gameId: string;
  classId: string;
  passPercentage: number;
  title?: string | null;
}): Promise<string> => {
  const { data: userData } = await db().auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { data: existing } = await db()
    .from("slate_game_assignments")
    .select(SELECT)
    .eq("game_id", params.gameId)
    .eq("class_id", params.classId)
    .maybeSingle();

  if (existing) {
    const row = existing as unknown as Row;
    await db()
      .from("slate_game_assignments")
      .update({
        unassigned_at: null,
        pass_percentage: params.passPercentage,
        title: params.title ?? row.title,
      } as never)
      .eq("id", row.id);
    return row.id;
  }

  const { data, error } = await db()
    .from("slate_game_assignments")
    .insert({
      game_id: params.gameId,
      class_id: params.classId,
      created_by: uid,
      pass_percentage: params.passPercentage,
      title: params.title ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "game_assign_failed");
  return (data as { id: string }).id;
};

/** Soft removal — student results are preserved. */
export const unassignGame = async (assignmentId: string): Promise<void> => {
  await db()
    .from("slate_game_assignments")
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("id", assignmentId);
};

export interface GameSummary {
  questions: GameQuestion[];
  questionCount: number;
  totalMarks: number;
}

/**
 * Live question count and mark total for ONE playable instance, from Floating
 * Numbers. `classId` omitted → the Game's own unscoped pool.
 */
export const summariseGame = async (
  gameId: string,
  classId?: string | null,
): Promise<GameSummary> => {
  const questions = await listGameQuestions(gameId, classId);
  return {
    questions,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + q.totalMarks, 0),
  };
};

export interface StudentGameAssignment extends GameAssignment {
  gameName: string;
  topic: string;
  subtopic: string;
  questionCount: number;
  totalMarks: number;
  /** Best marks ever earned — a restart can never take these away. */
  earnedMarks: number;
  completedQuestions: number;
  passed: boolean;
  /** 1-based Level the student is on right now. */
  currentLevel: number;
  status: "not_started" | "in_progress" | "complete";
}

/** Every Game assigned to this class, with the signed-in student's progress. */
export const listStudentGameAssignments = async (
  classId: string,
): Promise<StudentGameAssignment[]> => {
  const { data } = await db()
    .from("slate_game_assignments")
    .select(`${SELECT}, slate_games(name, topic, subtopic)`)
    .eq("class_id", classId)
    .is("unassigned_at", null)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as (Row & {
    slate_games: { name: string; topic: string | null; subtopic: string | null } | null;
  })[];
  if (rows.length === 0) return [];

  const { data: userData } = await db().auth.getUser();
  const uid = userData.user?.id ?? "";

  const [{ data: results }, { data: progressRows }] = await Promise.all([
    db()
      .from("slate_game_results")
      .select("assignment_id, marks_earned, best_marks_earned, marks_total, completed_at")
      .in("assignment_id", rows.map((r) => r.id))
      .eq("student_id", uid),
    db()
      .from("slate_game_progress")
      .select("assignment_id, question_index, status")
      .in("assignment_id", rows.map((r) => r.id))
      .eq("student_id", uid),
  ]);

  const mine = (results ?? []) as unknown as {
    assignment_id: string;
    marks_earned: number;
    best_marks_earned: number | null;
    marks_total: number;
    completed_at: string | null;
  }[];
  const progress = new Map(
    ((progressRows ?? []) as unknown as {
      assignment_id: string | null;
      question_index: number | null;
      status: string | null;
    }[]).map((row) => [row.assignment_id ?? "", row]),
  );

  return Promise.all(
    rows.map(async (row) => {
      const base = asRow(row);
      // Questions belong to THIS Class + Game instance only.
      const summary = await summariseGame(row.game_id, row.class_id);
      const own = mine.filter((r) => r.assignment_id === row.id);
      const earnedMarks = own.reduce(
        (sum, r) => sum + Math.max(Number(r.best_marks_earned ?? 0), Number(r.marks_earned ?? 0)),
        0,
      );
      const percent = summary.totalMarks > 0 ? (earnedMarks / summary.totalMarks) * 100 : 0;
      const run = progress.get(row.id);
      return {
        ...base,
        gameName: row.slate_games?.name ?? "Game",
        topic: row.slate_games?.topic ?? "",
        subtopic: row.slate_games?.subtopic ?? "",
        questionCount: summary.questionCount,
        totalMarks: summary.totalMarks,
        earnedMarks,
        completedQuestions: own.filter((r) => r.completed_at).length,
        passed: percent >= base.passPercentage,
        currentLevel: Math.max(1, Number(run?.question_index ?? 0) + 1),
        status: !run
          ? "not_started"
          : run.status === "complete"
            ? "complete"
            : "in_progress",
      } satisfies StudentGameAssignment;
    }),
  );
};

/**
 * Records the student's result for one Game question.
 *
 * REPORTING RULE: the report keeps the BEST marks ever earned. A restart may
 * reset the live run, but it can neither erase nor re-award marks the student
 * already has, so replaying can never inflate the report past the maximum.
 */
export const saveGameQuestionResult = async (params: {
  assignmentId: string;
  questionId: string;
  marksEarned: number;
  marksTotal: number;
  completed: boolean;
}): Promise<void> => {
  const { data: userData } = await db().auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const { data: existing } = await db()
    .from("slate_game_results")
    .select("best_marks_earned, marks_earned, completed_at")
    .eq("assignment_id", params.assignmentId)
    .eq("question_id", params.questionId)
    .eq("student_id", uid)
    .maybeSingle();
  const previousBest = Math.max(
    Number((existing as { best_marks_earned?: number } | null)?.best_marks_earned ?? 0),
    Number((existing as { marks_earned?: number } | null)?.marks_earned ?? 0),
  );
  const bestEver = Math.min(
    params.marksTotal,
    Math.max(previousBest, params.marksEarned),
  );
  const previouslyCompleted = Boolean(
    (existing as { completed_at?: string | null } | null)?.completed_at,
  );

  await db().from("slate_game_results").upsert(
    {
      assignment_id: params.assignmentId,
      question_id: params.questionId,
      student_id: uid,
      marks_earned: params.marksEarned,
      best_marks_earned: bestEver,
      marks_total: params.marksTotal,
      completed_at:
        params.completed || previouslyCompleted ? new Date().toISOString() : null,
    } as never,
    { onConflict: "assignment_id,question_id,student_id" },
  );
};
