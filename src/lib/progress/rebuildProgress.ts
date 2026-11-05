// Rebuild progress — a smooth, honest percentage for long AI runs.
//
// The teacher usually posts the same test again, so the model is not solving
// from nothing: it rewrites the known solution word for word and stretches any
// broken part back to standard classroom style, building it step by step to
// the end. The backend does not stream tokens, so progress is driven by the
// REAL milestones we do observe (items done, which part of an item is being
// written, pipeline stages) and eased smoothly INSIDE each milestone. It never
// jumps to 100% early and never moves backwards; 100% is shown only when the
// run has actually finished.

/** Fraction (0…ceiling) of a step that has probably elapsed, eased so it slows near the end. */
export function easedFraction(elapsedMs: number, expectedMs: number, ceiling = 0.95): number {
  if (!(elapsedMs > 0)) return 0;
  if (!(expectedMs > 0)) return ceiling;
  return ceiling * (1 - Math.exp(-elapsedMs / expectedMs));
}

/** A value inside [from, to] eased by elapsed time. */
export function bandValue(band: readonly [number, number], elapsedMs: number, expectedMs: number): number {
  const [from, to] = band;
  return from + (to - from) * easedFraction(elapsedMs, expectedMs);
}

export type BuildPhase = "question" | "figure" | "solution";

/** Share of ONE item each phase covers. The solution rebuild is the bulk. */
export const PHASE_SHARE: Record<BuildPhase, readonly [number, number]> = {
  question: [0, 0.25],
  figure: [0.25, 0.35],
  solution: [0.35, 1],
};

/** Typical time for each phase; only shapes the easing, never a limit. */
export const PHASE_EXPECTED_MS: Record<BuildPhase, number> = {
  question: 8_000,
  figure: 15_000,
  solution: 35_000,
};

export interface BuildProgressItem { state: string }
export interface RunningPhase { phase: BuildPhase; startedAt: number }

/**
 * Whole-run percentage for a Co-Pilot build: finished items count fully, the
 * running item counts by the phase it is in, eased by time inside that phase.
 * Capped at 99 until every item is settled.
 */
export function buildPercent(
  items: readonly BuildProgressItem[],
  running: RunningPhase | null,
  now: number,
): number {
  const counted = items.filter((i) => i.state !== "skipped");
  if (!counted.length) return 0;
  const settled = counted.filter((i) => i.state === "done" || i.state === "failed").length;
  let partial = 0;
  if (running && settled < counted.length) {
    const [from, to] = PHASE_SHARE[running.phase];
    partial = from + (to - from) * easedFraction(now - running.startedAt, PHASE_EXPECTED_MS[running.phase]);
  }
  const pct = ((settled + partial) / counted.length) * 100;
  if (settled >= counted.length) return 100;
  return clampPercent(Math.min(99, pct));
}

/** Pipeline stage → percentage band (section AI popover). */
export const STAGE_BANDS: Record<string, readonly [number, number]> = {
  INPUT_RECEIVED: [2, 10],
  ANALYSING: [10, 35],
  BLUEPRINT_READY: [35, 40],
  GENERATING_QUESTION: [40, 70],
  GENERATING_DIAGRAM: [70, 80],
  GENERATING_SOLUTION: [40, 92],
  VALIDATING: [92, 98],
  READY: [100, 100],
};

export const STAGE_EXPECTED_MS: Record<string, number> = {
  INPUT_RECEIVED: 3_000,
  ANALYSING: 20_000,
  BLUEPRINT_READY: 2_000,
  GENERATING_QUESTION: 25_000,
  GENERATING_DIAGRAM: 15_000,
  GENERATING_SOLUTION: 35_000,
  VALIDATING: 8_000,
  READY: 1,
};

export function stagePercent(stage: string, elapsedMs: number): number {
  const band = STAGE_BANDS[stage];
  if (!band) return 0;
  return clampPercent(bandValue(band, elapsedMs, STAGE_EXPECTED_MS[stage] ?? 20_000));
}

export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Never move backwards within one run. */
export function monotonic(previous: number | null, next: number): number {
  return previous == null ? next : Math.max(previous, next);
}
