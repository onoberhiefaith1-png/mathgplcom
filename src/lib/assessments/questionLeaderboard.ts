// Per-question class leaderboard.
//
// Read-only view over the existing timed-attempt layer: a student's rank comes
// from their BEST (lowest) successful attempt for that exact question. Students
// with no successful attempt are never given a position — they are listed
// separately as "Not started". Nothing here writes to the database.

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

/** Ranking with true ties sharing a position (1st, 1st, 3rd). */
export const rankByTime = <T extends { ms: number }>(rows: T[]): Array<T & { place: number }> => {
  const sorted = [...rows].sort((a, b) => a.ms - b.ms);
  const out: Array<T & { place: number }> = [];
  let place = 0;
  let prev: number | null = null;
  sorted.forEach((r, i) => {
    if (prev == null || r.ms !== prev) place = i + 1;
    prev = r.ms;
    out.push({ ...r, place });
  });
  return out;
};

export type LeaderboardMember = { userId: string; name: string };
export type RankedEntry = LeaderboardMember & { ms: number; place: number };
export type QuestionLeaderboard = {
  ranked: RankedEntry[];
  notStarted: LeaderboardMember[];
};

export type AttemptRow = { student_id: string; elapsed_ms: number | string; success: boolean };

/** Pure: fold attempts into best-time ranking + the not-started remainder. */
export const buildLeaderboard = (
  members: LeaderboardMember[],
  attempts: AttemptRow[],
): QuestionLeaderboard => {
  const best = new Map<string, number>();
  for (const a of attempts) {
    if (!a.success) continue;
    const ms = Number(a.elapsed_ms) || 0;
    const prev = best.get(a.student_id);
    if (prev == null || ms < prev) best.set(a.student_id, ms);
  }
  const byId = new Map(members.map((m) => [m.userId, m]));
  const timed: Array<LeaderboardMember & { ms: number }> = [];
  for (const [userId, ms] of best) {
    const m = byId.get(userId);
    // Keep times from people who have since left the roster out of the board.
    if (!m) continue;
    timed.push({ ...m, ms });
  }
  const ranked = rankByTime(timed);
  const notStarted = members
    .filter((m) => !best.has(m.userId))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ranked, notStarted };
};

export async function loadQuestionLeaderboard(opts: {
  assessmentId: string;
  questionId: string;
  classId: string;
}): Promise<QuestionLeaderboard> {
  const { assessmentId, questionId, classId } = opts;
  const [namesRes, attemptsRes] = await Promise.all([
    supabase.rpc("get_class_member_names", { _class_id: classId }),
    db
      .from("assessment_timer_attempts")
      .select("student_id, elapsed_ms, success")
      .eq("assessment_id", assessmentId)
      .eq("question_id", questionId)
      .eq("success", true),
  ]);

  const members: LeaderboardMember[] = (
    (namesRes.data ?? []) as { user_id: string; display_name: string | null }[]
  ).map((r) => ({ userId: r.user_id, name: r.display_name || "Student" }));

  const attempts = (attemptsRes?.data ?? []) as AttemptRow[];
  return buildLeaderboard(members, attempts);
}
