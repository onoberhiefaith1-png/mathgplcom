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
