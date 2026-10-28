/** Pure summaries of on-device Academia attempts. */
import type { LocalAttempt } from "@/lib/offline/academiaStore";

export type ActivitySummary = { activityId: string; attempts: number; best: number; latest: number; maxScore: number; lastAt: string };

export function summariseAttempts(attempts: LocalAttempt[]): Map<string, ActivitySummary> {
  const out = new Map<string, ActivitySummary>();
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  for (const a of sorted) {
    const prev = out.get(a.activityId);
    out.set(a.activityId, {
      activityId: a.activityId,
      attempts: (prev?.attempts ?? 0) + 1,
      best: Math.max(prev?.best ?? 0, a.score),
      latest: a.score,
      maxScore: a.maxScore,
      lastAt: a.at,
    });
  }
  return out;
}

/** Marks a line earns the moment it is written: all of them when proved equal, none otherwise. */
export function lineAward(correct: boolean, marks: number): number {
  return correct ? marks : 0;
}
