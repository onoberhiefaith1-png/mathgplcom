// A Game is given to a class as its own assignment type. The Game stays the
// container: its questions, marks and timing are read live from Floating
// Numbers, never copied here.

import { supabase } from "@/integrations/supabase/client";
import { listGameQuestions, type GameQuestion } from "./gameQuestions";

export interface GameAssignment {
  id: string;
  gameId: string;
  classId: string;
  passPercentage: number;
  title: string | null;
  active: boolean;
}

const SELECT = "id, game_id, class_id, pass_percentage, title, unassigned_at";

type Row = {
  id: string;
  game_id: string;
  class_id: string;
  pass_percentage: number;
  title: string | null;
  unassigned_at: string | null;
};

const asRow = (row: Row): GameAssignment => ({
  id: row.id,
  gameId: row.game_id,
  classId: row.class_id,
  passPercentage: Number(row.pass_percentage ?? 70),
  title: row.title,
  active: !row.unassigned_at,
});

/** Active game assignments per class for one Game. */
export const loadGameAssignmentState = async (
  gameId: string,
): Promise<Map<string, GameAssignment>> => {
  const byClass = new Map<string, GameAssignment>();
  if (!gameId) return byClass;
  const { data } = await supabase
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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { data: existing } = await supabase
    .from("slate_game_assignments")
    .select(SELECT)
    .eq("game_id", params.gameId)
    .eq("class_id", params.classId)
    .maybeSingle();

  if (existing) {
    const row = existing as unknown as Row;
    await supabase
      .from("slate_game_assignments")
      .update({
        unassigned_at: null,
        pass_percentage: params.passPercentage,
        title: params.title ?? row.title,
      } as never)
      .eq("id", row.id);
    return row.id;
  }

  const { data, error } = await supabase
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
  await supabase
    .from("slate_game_assignments")
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("id", assignmentId);
};

export interface GameSummary {
  questions: GameQuestion[];
  questionCount: number;
  totalMarks: number;
}

/** Live question count and mark total for a Game, from Floating Numbers. */
export const summariseGame = async (gameId: string): Promise<GameSummary> => {
  const questions = await listGameQuestions(gameId);
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
  earnedMarks: number;
  completedQuestions: number;
  passed: boolean;
}

/** Every Game assigned to this class, with the signed-in student's progress. */
export const listStudentGameAssignments = async (
  classId: string,
): Promise<StudentGameAssignment[]> => {
  const { data } = await supabase
    .from("slate_game_assignments")
    .select(`${SELECT}, slate_games(name, topic, subtopic)`)
    .eq("class_id", classId)
    .is("unassigned_at", null)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as (Row & {
    slate_games: { name: string; topic: string | null; subtopic: string | null } | null;
  })[];
  if (rows.length === 0) return [];

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "";

  const { data: results } = await supabase
    .from("slate_game_results")
    .select("assignment_id, marks_earned, marks_total, completed_at")
    .in("assignment_id", rows.map((r) => r.id))
    .eq("student_id", uid);

  const mine = (results ?? []) as unknown as {
    assignment_id: string;
    marks_earned: number;
    marks_total: number;
    completed_at: string | null;
  }[];

  return Promise.all(
    rows.map(async (row) => {
      const base = asRow(row);
      const summary = await summariseGame(row.game_id);
      const own = mine.filter((r) => r.assignment_id === row.id);
      const earnedMarks = own.reduce((sum, r) => sum + Number(r.marks_earned ?? 0), 0);
      const percent = summary.totalMarks > 0 ? (earnedMarks / summary.totalMarks) * 100 : 0;
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
      } satisfies StudentGameAssignment;
    }),
  );
};

/** Records (or updates) the student's result for one Game question. */
export const saveGameQuestionResult = async (params: {
  assignmentId: string;
  questionId: string;
  marksEarned: number;
  marksTotal: number;
  completed: boolean;
}): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase.from("slate_game_results").upsert(
    {
      assignment_id: params.assignmentId,
      question_id: params.questionId,
      student_id: uid,
      marks_earned: params.marksEarned,
      marks_total: params.marksTotal,
      completed_at: params.completed ? new Date().toISOString() : null,
    } as never,
    { onConflict: "assignment_id,question_id,student_id" },
  );
};
