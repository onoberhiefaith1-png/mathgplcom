/**
 * Per-tier evaluation scores. One tier never borrows another tier's marks.
 * Untiered work (older attempts whose tier cannot be inferred) is counted
 * only in Overall.
 *
 * Overall is marks earned ÷ marks possible across every included attempt.
 * A tier with more marks therefore counts for more than a short one. Averaging
 * the three tier percentages would treat a single Beginner question the same
 * as a long Expert paper, so that average is not used. A tier with no attempts
 * is "not started" (percent null) and is not entered as 0%.
 */
import { isTier, TIERS, type AcademiaTier, type PerformanceView } from "@/lib/academia/tiers";

export type { PerformanceView };
export const PERFORMANCE_VIEWS = [...TIERS, "overall"] as const satisfies readonly PerformanceView[];

export const PERFORMANCE_LABEL: Record<PerformanceView, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
  overall: "Overall",
};

export const OVERALL_EXPLANATION =
  "Overall is every mark earned divided by every mark possible, across Beginner, Intermediate, Expert, and older work that has no tier. A tier with more marks counts for more than a short one. A tier you have not started is left off its own tab and is not treated as 0%.";

export function performanceExplanation(view: PerformanceView): string {
  if (view === "overall") return OVERALL_EXPLANATION;
  const name = PERFORMANCE_LABEL[view];
  return `${name} only. Marks from the other tiers stay on their own tabs and are not included here.`;
}

export type MarkedWork = {
  tier: AcademiaTier | null;
  earned: number;
  possible: number;
};

export type PerformanceScore = {
  view: PerformanceView;
  earned: number;
  possible: number;
  /** Null when this view has no marks possible yet (not started). */
  percent: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Marks-weighted score for one tier, or for every tier plus untiered work. */
export function performanceScore(work: MarkedWork[], view: PerformanceView): PerformanceScore {
  const rows = work.filter((w) => (view === "overall" ? true : w.tier === view));
  const earned = round2(rows.reduce((n, w) => n + Math.max(0, num(w.earned)), 0));
  const possible = round2(rows.reduce((n, w) => n + Math.max(0, num(w.possible)), 0));
  return {
    view,
    earned,
    possible,
    percent: possible > 0 ? round2((earned / possible) * 100) : null,
  };
}

/** Connected Academia stores one practice row per session per tier. */
export function practiceMarks(attempts: { mode?: string | null; tier?: unknown; best_score?: unknown; max_score?: unknown }[]): MarkedWork[] {
  return attempts
    .filter((a) => a.mode === "practice")
    .map((a) => ({
      tier: isTier(a.tier) ? a.tier : null,
      earned: Math.max(0, num(a.best_score)),
      possible: Math.max(0, num(a.max_score)),
    }));
}
