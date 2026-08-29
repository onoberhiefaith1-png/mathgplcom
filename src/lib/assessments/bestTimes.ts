// Per-question best-time benchmark.
//
// Two numbers only: the current user's fastest successful attempt on that exact
// question, and the fastest successful attempt by ANYONE on the same question —
// registered students plus eligible guests arriving through a public link.
// No names, no positions, no per-person rows ever leave the database.

import { supabase } from "@/integrations/supabase/client";

export type QuestionBestTimes = { myBestMs: number | null; overallBestMs: number | null };

const toMs = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function fetchQuestionBestTimes(
  assessmentId: string,
  questionId: string,
): Promise<QuestionBestTimes> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<any>;
  const { data, error } = await rpc("question_best_times", {
    _assessment_id: assessmentId,
    _question_id: questionId,
  });
  if (error) {
    console.warn("[best-times] load failed", error.message);
    return { myBestMs: null, overallBestMs: null };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { my_best_ms?: unknown; overall_best_ms?: unknown }
    | null
    | undefined;
  return {
    myBestMs: toMs(row?.my_best_ms),
    overallBestMs: toMs(row?.overall_best_ms),
  };
}
