// Academia Adventure — pure rules. A learning point (scene) is the identity
// of a question slot; progress-bar names are only labels and never group.

export const DEFAULT_PASS_PCT = 100;

export type SlotQuestion = { id: string; sceneId: string; position: number; totalMarks: number };

/** Questions of ONE learning point, in the teacher's order. */
export function questionsForPoint<T extends SlotQuestion>(rows: T[], sceneId: string): T[] {
  return rows.filter((r) => r.sceneId === sceneId).sort((a, b) => a.position - b.position);
}

export function pointTotalMarks(rows: SlotQuestion[], sceneId: string): number {
  return questionsForPoint(rows, sceneId).reduce((sum, r) => sum + (Number(r.totalMarks) || 0), 0);
}

/** Saved pass mark, or 100% when none was set; always kept within 1–100. */
export function passPctOf(saved: number | null | undefined): number {
  const n = Number(saved);
  if (saved == null || !Number.isFinite(n)) return DEFAULT_PASS_PCT;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/** Earned marks as a 0–1 share of the learning point's total. */
export function progressFraction(earned: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, earned / total));
}

export function hasPassed(earned: number, total: number, passPct: number | null | undefined): boolean {
  if (!(total > 0)) return true;
  return progressFraction(earned, total) * 100 >= passPctOf(passPct) - 1e-9;
}

/** Earned marks counted once per question (a replay keeps the best). */
export function earnedMarks(results: Record<string, number>): number {
  return Object.values(results).reduce((sum, v) => sum + (Number(v) || 0), 0);
}
export function recordResult(results: Record<string, number>, questionId: string, marks: number): Record<string, number> {
  return { ...results, [questionId]: Math.max(results[questionId] ?? 0, Number(marks) || 0) };
}

/** Time bar: fills bottom → top from the start to the (possibly extended) deadline. */
export function timeFillFraction(startedAt: number | null, deadline: number | null, now: number): number {
  if (!startedAt || !deadline || deadline <= startedAt) return 0;
  return Math.min(1, Math.max(0, (now - startedAt) / (deadline - startedAt)));
}

/** Move one question up (-1) or down (+1); returns the new id order. */
export function moveInOrder(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

type Line = { equation?: unknown; questionId?: unknown; lineId?: unknown; marks?: unknown } & Record<string, unknown>;
/** The lines that belong to one question (same rule as the offline pack). */
export function linesForQuestion(raw: unknown, questionKey: string | null): (Line & { id: string; marks: number })[] {
  const all = (Array.isArray(raw) ? raw : []).filter(
    (l): l is Line => !!l && typeof l === "object" && typeof (l as Line).equation === "string" && !!String((l as Line).equation).trim(),
  );
  const own = questionKey ? all.filter((l) => !l.questionId || l.questionId === questionKey) : all;
  return (own.length ? own : all).map((l, i) => ({
    ...l,
    id: (l.lineId as string) || `line-${i + 1}`,
    marks: Math.max(0, Number(l.marks) || 0),
  }));
}

// ── Learning-point entry, bars and clock (shared by the online and downloaded player) ──

type PointLike = { id: string; loopStart?: number; loopEnd?: number };

/**
 * The learning point the student must be inside RIGHT NOW: the first unfinished
 * point whose loop has started (`t >= loopStart`). Unlike a plain "t is inside
 * [start, end)" test this also catches a point the playhead already jumped past
 * (a coarse `timeupdate`, a buffered seek, a resume position), so a point is
 * never silently skipped. `points` must be sorted by `loopStart`.
 */
export function pointDue<P extends PointLike>(points: P[], t: number, done: ReadonlySet<string>): P | null {
  if (!Number.isFinite(t)) return null;
  for (const p of points) {
    if (done.has(p.id)) continue;
    if (typeof p.loopStart !== "number" || typeof p.loopEnd !== "number") continue;
    if (t >= p.loopStart) return p;
  }
  return null;
}

/** Countdown seconds of a learning point: its Time Progress Bar, else the older per-point timer. 0 = no clock. */
export function pointTimeSeconds(scene: { elements?: unknown[]; timerEnabled?: boolean; timeLimit?: number } | null | undefined, designedSeconds: number): number {
  if (!scene) return 0;
  if (designedSeconds > 0) return designedSeconds;
  if (scene.timerEnabled) {
    const n = Math.round(Number(scene.timeLimit ?? 300));
    return Number.isFinite(n) && n > 0 ? n : 300;
  }
  return 0;
}

export type PointClock = { start: number; deadline: number };

/**
 * The clock the time bar follows. A question's own Game timer wins (it can be
 * extended by a time bonus, which keeps the original start). Without one the
 * learning point's own countdown runs. Null = nothing to show.
 */
export function effectiveClock(gameClock: PointClock | null, pointClock: PointClock | null): PointClock | null {
  return gameClock ?? pointClock;
}

/** The Game reports a (new or extended) deadline; keep `start` while it only moves, drop it when cleared. */
export function nextGameClock(prev: PointClock | null, deadline: number | null, now: number): PointClock | null {
  return deadline ? { start: prev?.start ?? now, deadline } : null;
}

/** A learning point's own countdown starting at `now`, or null when it has no time. */
export function startPointClock(seconds: number, now: number): PointClock | null {
  return seconds > 0 ? { start: now, deadline: now + seconds * 1000 } : null;
}

export function clockExpired(clock: PointClock | null, now: number): boolean {
  return !!clock && now >= clock.deadline;
}

/** Share of time LEFT (1 → 0). Uses the same fill rule as `timeFillFraction`. */
export function timeLeftFraction(clock: PointClock | null, now: number): number {
  return clock ? 1 - timeFillFraction(clock.start, clock.deadline, now) : 0;
}

type BarElement = { id: string; kind?: string; progress?: unknown };
/**
 * Which designed bars a learning point has. Mirrors the Adventure editor: the
 * explicit Time bar, or (legacy, no roles) the FIRST progress bar, is the clock;
 * the first other progress bar is the learning bar. A missing bar is null and
 * the player draws its plain default instead — a bar is never simply absent.
 */
export function designedBarsOf<E extends BarElement>(elements: E[] | null | undefined): { time: E | null; learning: E | null } {
  const bars = (elements ?? []).filter((e) => e.kind === "progress_bar" && !!e.progress);
  const roleOf = (e: E) => (e.progress as { role?: string }).role;
  const time = bars.find((e) => roleOf(e) === "time") ?? bars[0] ?? null;
  const learning = bars.find((e) => e !== time && roleOf(e) !== "time") ?? null;
  return { time, learning };
}

/** The time bar is shown whenever a clock is running, unless the teacher hid it on that point. */
export function showTimeBar(clock: PointClock | null, timerVisible: boolean | undefined): boolean {
  return !!clock && timerVisible !== false;
}
