/**
 * Academia tiers: every Session holds three practice batches — Beginner,
 * Intermediate and Expert. Pure helpers shared by the Session page, the
 * class–subject progress view and the API guards (no Supabase here).
 */
export const TIERS = ["beginner", "intermediate", "expert"] as const;
export type AcademiaTier = (typeof TIERS)[number];
export const DEFAULT_TIER: AcademiaTier = "beginner";
export const TIER_LABEL: Record<AcademiaTier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};
/** Each tier expects at least this many questions (plan §3). */
export const TIER_TARGET_QUESTIONS = 10;
export const NOT_STARTED_LABEL = "not started yet";

export const isTier = (v: unknown): v is AcademiaTier => typeof v === "string" && (TIERS as readonly string[]).includes(v);
/** Old rows (before tiers) and unknown values count as Beginner. */
export const normalizeTier = (v: unknown): AcademiaTier => (isTier(v) ? v : DEFAULT_TIER);
export const tierRank = (v: unknown) => TIERS.indexOf(normalizeTier(v));

type Tiered = { id: string; tier?: string | null; position?: number | null };

/** Beginner batch first, then Intermediate, then Expert; position inside each. */
export function sortByTier<T extends Tiered>(rows: T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => tierRank(a.row.tier) - tierRank(b.row.tier)
      || (Number(a.row.position) || 0) - (Number(b.row.position) || 0)
      || a.i - b.i)
    .map((x) => x.row);
}

export function groupByTier<T extends Tiered>(rows: T[]): Record<AcademiaTier, T[]> {
  const out: Record<AcademiaTier, T[]> = { beginner: [], intermediate: [], expert: [] };
  for (const row of sortByTier(rows)) out[normalizeTier(row.tier)].push(row);
  return out;
}

export class CrossTierMoveError extends Error {
  constructor() {
    super("Activities can only be reordered inside their own tier.");
    this.name = "CrossTierMoveError";
  }
}

/** Every id must belong to one tier batch; otherwise the move is refused. */
export function assertSingleTier<T extends Tiered>(rows: T[], ids: string[]): AcademiaTier {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const tiers = new Set(ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error("That activity is not in this Session.");
    return normalizeTier(row.tier);
  }));
  if (tiers.size !== 1) throw new CrossTierMoveError();
  return [...tiers][0];
}

/**
 * Swap one activity with its neighbour inside the same tier. Returns the new
 * id order for that tier only, or null when the move would leave the tier.
 */
export function moveWithinTier<T extends Tiered>(rows: T[], id: string, delta: -1 | 1): { tier: AcademiaTier; ids: string[] } | null {
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  const tier = normalizeTier(row.tier);
  const ids = groupByTier(rows)[tier].map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return { tier, ids };
}

// ---------------------------------------------------------------- Evaluation

export type TierStatus = "not_started" | "in_progress" | "completed";
export type AttemptLike = {
  session_id: string;
  user_id?: string;
  mode: string;
  tier?: string | null;
  score?: number | string | null;
  best_score?: number | string | null;
  max_score?: number | string | null;
  status?: string | null;
};
export type TierEvaluation = { tier: AcademiaTier; status: TierStatus; score: number; max: number; label: string };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** One tier's own evaluation for one learner in one Session. Untouched tiers
 *  are "not started yet" and never borrow marks from another tier. */
export function tierEvaluation(attempts: AttemptLike[], sessionId: string, tier: AcademiaTier): TierEvaluation {
  const mine = attempts.filter((a) => a.session_id === sessionId && normalizeTier(a.tier) === tier);
  if (!mine.length) return { tier, status: "not_started", score: 0, max: 0, label: NOT_STARTED_LABEL };
  const practice = mine.find((a) => a.mode === "practice");
  const score = practice ? num(practice.best_score) : 0;
  const max = practice ? num(practice.max_score) : 0;
  const status: TierStatus = mine.some((a) => a.status === "completed") ? "completed" : "in_progress";
  const marks = max > 0 ? ` · ${score}/${max}` : "";
  return { tier, status, score, max, label: `${status === "completed" ? "Completed" : "In progress"}${marks}` };
}

export const sessionTierEvaluations = (attempts: AttemptLike[], sessionId: string): TierEvaluation[] =>
  TIERS.map((t) => tierEvaluation(attempts, sessionId, t));

/** Per-activity marks kept on a tier attempt (activity id → marks). */
export type ActivityScores = Record<string, { score: number; max: number; done: boolean }>;

/** Roll a tier's activity marks up into the tier attempt. */
export function rollUpTier(scores: ActivityScores, tierActivityIds: string[]) {
  let score = 0;
  let max = 0;
  let counted = 0;
  let done = 0;
  for (const id of tierActivityIds) {
    const s = scores[id];
    if (!s) continue;
    counted += 1;
    score += num(s.score);
    max += num(s.max);
    if (s.done) done += 1;
  }
  const completed = tierActivityIds.length > 0 && done === tierActivityIds.length;
  return { score, max, completed, counted };
}

// ---------------------------------------------------- Class–subject reports

export type ReportSession = { id: string; title: string };
export type ReportActivity = { id: string; session_id: string; tier?: string | null; max: number };
export type LadderStep = {
  tier: AcademiaTier;
  attemptedScore: number;
  attemptedMax: number;
  totalMax: number;
  sessionsAttempted: number;
  sessionsCompleted: number;
  sessionsTotal: number;
};
export type ClassSubjectReport = {
  /** Primary: marks over the total marks of the attempted session tiers only. */
  attemptedScore: number;
  attemptedMax: number;
  /** Context: every mark available in this class–subject (e.g. 50 of 300). */
  totalMax: number;
  ladder: LadderStep[];
  sessions: { id: string; title: string; tiers: TierEvaluation[] }[];
};

/**
 * Evaluation for ONE class + subject pair (e.g. Year One · Mathematics). Only
 * sessions passed in count; attempts or activities from any other pair are
 * ignored, so totals are never combined across pairs.
 */
export function buildClassSubjectReport(input: {
  sessions: ReportSession[];
  activities: ReportActivity[];
  attempts: AttemptLike[];
}): ClassSubjectReport {
  const inScope = new Set(input.sessions.map((s) => s.id));
  const activities = input.activities.filter((a) => inScope.has(a.session_id));
  const attempts = input.attempts.filter((a) => inScope.has(a.session_id));
  const available = new Map<string, number>();
  for (const a of activities) {
    const k = `${a.session_id}|${normalizeTier(a.tier)}`;
    available.set(k, (available.get(k) ?? 0) + Math.max(0, num(a.max)));
  }
  const sessions = input.sessions.map((s) => ({ id: s.id, title: s.title, tiers: sessionTierEvaluations(attempts, s.id) }));
  const ladder: LadderStep[] = TIERS.map((tier) => {
    const step: LadderStep = { tier, attemptedScore: 0, attemptedMax: 0, totalMax: 0, sessionsAttempted: 0, sessionsCompleted: 0, sessionsTotal: 0 };
    for (const s of sessions) {
      const avail = available.get(`${s.id}|${tier}`) ?? 0;
      step.totalMax += avail;
      if (avail > 0) step.sessionsTotal += 1;
      const ev = s.tiers.find((t) => t.tier === tier)!;
      if (ev.status === "not_started") continue;
      step.sessionsAttempted += 1;
      if (ev.status === "completed") step.sessionsCompleted += 1;
      const max = Math.max(avail, ev.max);
      step.attemptedMax += max;
      step.attemptedScore += Math.min(ev.score, max || ev.score);
    }
    return step;
  });
  return {
    attemptedScore: ladder.reduce((n, s) => n + s.attemptedScore, 0),
    attemptedMax: ladder.reduce((n, s) => n + s.attemptedMax, 0),
    totalMax: ladder.reduce((n, s) => n + s.totalMax, 0),
    ladder,
    sessions,
  };
}

export const percent = (score: number, max: number) => (max > 0 ? Math.round((score / max) * 100) : 0);

// ---------------------------------------------------------------- Cancel

export type CancelCheck = {
  callerIsLearner: boolean;
  callerIsTeacher: boolean;
  teacherAssigned: boolean;
  alreadyCancelled: boolean;
  hasAttempt: boolean;
};
export type CancelDecision = { ok: true } | { ok: false; reason: "not_allowed" | "teacher_assigned" | "already_cancelled" | "nothing_to_cancel" };

/** Mirrors academia_cancel_session_attempt: one cancel per learner per Session;
 *  teachers may always cancel; students only their own self-practice. */
export function cancelDecision(c: CancelCheck): CancelDecision {
  if (!c.callerIsTeacher && !c.callerIsLearner) return { ok: false, reason: "not_allowed" };
  if (!c.callerIsTeacher && c.teacherAssigned) return { ok: false, reason: "teacher_assigned" };
  if (c.alreadyCancelled) return { ok: false, reason: "already_cancelled" };
  if (!c.hasAttempt) return { ok: false, reason: "nothing_to_cancel" };
  return { ok: true };
}

export const CANCEL_REASON_TEXT: Record<Exclude<CancelDecision, { ok: true }>["reason"], string> = {
  not_allowed: "Only the learner or a teacher of this subject can cancel.",
  teacher_assigned: "Your teacher assigned this Session, so only a teacher can cancel it.",
  already_cancelled: "This Session has already used its one cancel.",
  nothing_to_cancel: "There is no attempt to cancel yet.",
};
