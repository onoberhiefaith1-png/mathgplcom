/**
 * Cumulative, attempt-based evaluation for the downloaded Academia app.
 * Pure functions only — storage lives in academiaStore.
 *
 * Rules: an attempt starts on the first mathematical input (never on opening
 * or watching); each Session attempt is worth SESSION_MARKS, with all its
 * activities' marks scaled together into that total; Continue reuses the
 * attempt; Restart makes a new one (old kept); removed unfinished attempts
 * leave the totals; the same marking event is never counted twice.
 */
export const SESSION_MARKS = 10;

export type AttemptStatus = "in_progress" | "completed" | "removed";
export type SessionContext = {
  sessionId: string; sessionTitle: string; trail: string;
  schoolId: string; classId: string; subjectId: string; subjectName: string;
  topicId: string; topicName: string; subtopicId: string; subtopicName: string;
  /** Maximum raw marks per activity in this Session. */
  activityMax: Record<string, number>;
};
export type SessionAttempt = SessionContext & {
  id: string;
  attemptNo: number;
  status: AttemptStatus;
  /** Set when a newer attempt for the same Session replaced this one for Continue. */
  superseded?: boolean;
  startedAt: string;
  lastAt: string;
  completedAt?: string | null;
  removedAt?: string | null;
  maxMarks: number;
  /** Raw marks earned per `${activityId}:${mode}`. */
  modeEarned: Record<string, number>;
  eventIds: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Raw best per activity (best of Practice/Play), capped at that activity's maximum. */
export function activityEarned(a: SessionAttempt, activityId: string): number {
  const max = a.activityMax[activityId] ?? 0;
  let best = 0;
  for (const [k, v] of Object.entries(a.modeEarned)) if (k.startsWith(`${activityId}:`)) best = Math.max(best, v);
  return Math.min(best, max);
}

/** Session marks: sum of activity marks ÷ sum of activity maximums × 10, capped. */
export function attemptEarned(a: SessionAttempt): number {
  const ids = Object.keys(a.activityMax);
  const totalMax = ids.reduce((n, id) => n + (a.activityMax[id] ?? 0), 0);
  if (totalMax <= 0) return 0;
  const raw = ids.reduce((n, id) => n + activityEarned(a, id), 0);
  return round2(Math.min(a.maxMarks, (raw / totalMax) * a.maxMarks));
}

/** Completed only when every activity with marks has been fully finished. */
export function isComplete(a: SessionAttempt): boolean {
  const ids = Object.keys(a.activityMax).filter((id) => (a.activityMax[id] ?? 0) > 0);
  return ids.length > 0 && ids.every((id) => activityEarned(a, id) >= (a.activityMax[id] ?? 0));
}

/** The attempt Continue resumes for a Session, if any. */
export function currentAttempt(all: SessionAttempt[], sessionId: string): SessionAttempt | null {
  return [...all].filter((a) => a.sessionId === sessionId && a.status === "in_progress" && !a.superseded)
    .sort((x, y) => y.startedAt.localeCompare(x.startedAt))[0] ?? null;
}

/**
 * Called on a mathematical input. Returns the attempts list with the active
 * attempt (resumed or newly created) and that attempt. `restart` forces a new
 * attempt even if one is in progress (the old one stays in history).
 */
export function ensureAttempt(all: SessionAttempt[], ctx: SessionContext, opts: { now: string; id: string; restart?: boolean }) {
  const existing = currentAttempt(all, ctx.sessionId);
  if (existing && !opts.restart) return { attempts: all, attempt: existing, created: false };
  const attemptNo = all.filter((a) => a.sessionId === ctx.sessionId).length + 1;
  const attempt: SessionAttempt = {
    ...ctx, id: opts.id, attemptNo, status: "in_progress", startedAt: opts.now, lastAt: opts.now,
    completedAt: null, removedAt: null, maxMarks: SESSION_MARKS, modeEarned: {}, eventIds: [],
  };
  const rest = all.map((a) => (existing && a.id === existing.id ? { ...a, superseded: true } : a));
  return { attempts: [...rest, attempt], attempt, created: true };
}

/** Adds one marking event (idempotent by eventId). */
export function recordMarks(a: SessionAttempt, ev: { eventId: string; activityId: string; mode: "practice" | "play"; marks: number; now: string }): SessionAttempt {
  if (a.status !== "in_progress" || a.eventIds.includes(ev.eventId)) return a;
  const key = `${ev.activityId}:${ev.mode}`;
  const max = a.activityMax[ev.activityId] ?? 0;
  const next: SessionAttempt = {
    ...a,
    lastAt: ev.now,
    eventIds: [...a.eventIds, ev.eventId],
    modeEarned: { ...a.modeEarned, [key]: Math.min(max, (a.modeEarned[key] ?? 0) + Math.max(0, ev.marks)) },
  };
  return isComplete(next) ? { ...next, status: "completed", completedAt: ev.now } : next;
}

/** Removes an unfinished attempt from evaluation; completed attempts are never removed. */
export function removeAttempt(a: SessionAttempt, now: string): SessionAttempt {
  return a.status === "in_progress" ? { ...a, status: "removed", removedAt: now } : a;
}
export function recoverAttempt(a: SessionAttempt): SessionAttempt {
  return a.status === "removed" ? { ...a, status: "in_progress", removedAt: null } : a;
}

export type Totals = { earned: number; possible: number; percent: number | null; started: number; completed: number; active: number };
export function totals(all: SessionAttempt[], keep: (a: SessionAttempt) => boolean = () => true): Totals {
  const active = all.filter((a) => a.status !== "removed" && keep(a));
  const earned = round2(active.reduce((n, a) => n + attemptEarned(a), 0));
  const possible = active.reduce((n, a) => n + a.maxMarks, 0);
  return {
    earned, possible,
    percent: possible > 0 ? round2((earned / possible) * 100) : null,
    started: active.filter((a) => a.status === "in_progress").length,
    completed: active.filter((a) => a.status === "completed").length,
    active: active.length,
  };
}

/** Cumulative percentage after each attempt, in the order attempts started. */
export function evaluationSeries(all: SessionAttempt[]): { at: string; percent: number }[] {
  const active = all.filter((a) => a.status !== "removed").sort((x, y) => x.startedAt.localeCompare(y.startedAt));
  const out: { at: string; percent: number }[] = [];
  let earned = 0, possible = 0;
  for (const a of active) {
    earned += attemptEarned(a); possible += a.maxMarks;
    out.push({ at: a.completedAt ?? a.lastAt, percent: round2((earned / possible) * 100) });
  }
  return out;
}

export const startedList = (all: SessionAttempt[]) =>
  all.filter((a) => a.status === "in_progress").sort((x, y) => y.lastAt.localeCompare(x.lastAt));
export const completedList = (all: SessionAttempt[]) =>
  all.filter((a) => a.status === "completed").sort((x, y) => (y.completedAt ?? "").localeCompare(x.completedAt ?? ""));
