// GAME EVALUATION — pure derivation for the live line-by-line Game Inspector.
//
// This module OBSERVES. It owns no mathematics, no marking and no rewards: it
// reads the values the Game already holds and turns them into plain statements a
// teacher can read while a student works. The Smartboard evaluation and the
// Assignment evaluation are untouched by anything here.

import { getReward } from "@/lib/slate/rewards";
import { vaultMatches } from "@/lib/slate/lineSurfaces";
import type { MappedLine } from "@/lib/slate/pattern";

export type MathStatus =
  | "question"
  | "not_started"
  | "in_progress"
  | "incomplete"
  | "equivalent"
  | "not_equivalent"
  | "correct"
  | "completed";

export const MATH_STATUS_LABEL: Record<MathStatus, string> = {
  question: "Question line — read only",
  not_started: "Not started",
  in_progress: "In progress",
  incomplete: "Incomplete",
  equivalent: "Equivalent detected",
  not_equivalent: "Not equivalent",
  correct: "Correct",
  completed: "Completed",
};

/** One grading result the board reported, exactly as the engine produced it. */
export interface InspectVerdict {
  lineId: string;
  correct: boolean;
  verdict?: string;
  marks?: number;
  /** The student expression that verdict belongs to. */
  studentAscii?: string;
  at: number;
}

export type RewardStage = "waiting" | "condition_met" | "activated" | "awarded" | "expired";

export const REWARD_STAGE_LABEL: Record<RewardStage, string> = {
  waiting: "Waiting for condition",
  condition_met: "✓ Condition met",
  activated: "✓ Reward activated",
  awarded: "✓ Reward awarded",
  expired: "Expired — dissolved unpaid",
};

/** GLANCEABLE status. The panel shows the reward's own artwork plus this. */
export const REWARD_STAGE_SHORT: Record<RewardStage, string> = {
  waiting: "WAITING",
  condition_met: "✓ ACTIVATED",
  activated: "✓ ACTIVATED",
  awarded: "✓ AWARDED",
  expired: "EXPIRED",
};

export interface RewardReport {
  id: string;
  type: string;
  label: string;
  condition: string;
  conditionMet: boolean;
  stage: RewardStage;
  /** Extra live detail: Vault sequence, hourglass payout, life value. */
  detail?: string;
  /** The reward's real Game artwork, so the panel shows the object itself. */
  art: string;
  openArt?: string;
  glow: string;
  /** A Vault's own encrypted code — the one piece of text worth showing. */
  code?: string | null;
}

/** One visual group: every reward of the same type on the CURRENT line. */
export interface RewardGroup {
  type: string;
  label: string;
  items: RewardReport[];
}

/** Rewards of one type belong together. Order follows the teacher's placement. */
export const groupRewards = (rewards: readonly RewardReport[]): RewardGroup[] => {
  const groups: RewardGroup[] = [];
  for (const reward of rewards) {
    const existing = groups.find((g) => g.type === reward.type);
    if (existing) existing.items.push(reward);
    else groups.push({ type: reward.type, label: reward.label, items: [reward] });
  }
  return groups;
};

export interface LineReport {
  line: number;
  isQuestion: boolean;
  lineId: string | null;
  expected: string | null;
  student: string;
  status: MathStatus;
  /** Marks the teacher attached to this line. */
  lineMarks: number;
  scoreAwarded: boolean;
  /** Equivalence reported but no mark recorded — a Game-engine inconsistency. */
  scoreInconsistent: boolean;
  noteUnlocked: boolean;
  hasNote: boolean;
  rewards: RewardReport[];
  /** Shortest valid remaining route to a complete, equivalent line. */
  predictive: string | null;
  remaining: string | null;
  noRoute: boolean;
  /** A structure (fraction, root, bracket…) was started but not finished. */
  structureMissing: string | null;
  /** The shared engine has proved this line complete and equivalent. */
  predictionComplete: boolean;
  /** Final piece of the current correct route — rendered red. */
  completionToken: string | null;
}

/** Exactly what the shared Predictive Line Engine reported for this line. */
export interface InspectPrediction {
  status: "empty" | "incomplete" | "complete" | "no_route" | "incomplete_structure";
  predictive: string;
  remaining: readonly string[];
  complete: boolean;
  missing?: string;
  completionToken?: string | null;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

/** An equation target needs both sides written before it can ever be correct. */
export const looksIncomplete = (expected: string | null, student: string): boolean => {
  const text = clean(student);
  if (!text) return false;
  if (/[=+\-*/^]$/.test(text)) return true;
  if (clean(expected).includes("=")) {
    const parts = text.split("=");
    if (parts.length < 2) return true;
    return parts.some((side) => side.trim().length === 0);
  }
  return false;
};

export const deriveMathStatus = (input: {
  isQuestion: boolean;
  expected: string | null;
  student: string;
  awarded: boolean;
  verdict?: InspectVerdict | null;
  prediction?: InspectPrediction | null;
}): MathStatus => {
  if (input.isQuestion) return "question";
  const student = clean(input.student);
  if (input.awarded) return "completed";
  if (!student) return "not_started";
  const fresh =
    input.verdict && clean(input.verdict.studentAscii) === student ? input.verdict : null;
  if (fresh?.correct) return "equivalent";
  // The Predictive Line already knows the construction is complete and
  // equivalent, so the panel says so without waiting for the marking service.
  if (input.prediction?.complete) return "equivalent";
  if (input.prediction?.status === "no_route") return "not_equivalent";
  if (looksIncomplete(input.expected, student)) return "incomplete";
  if (fresh && !fresh.correct) {
    return fresh.verdict === "parse_error" ? "incomplete" : "not_equivalent";
  }
  return "in_progress";
};

const vaultCondition = (expression: string | null | undefined) =>
  expression
    ? `Student must write ${expression} in this exact order (an equivalent order does not open it)`
    : "No Vault code configured on this line";

const conditionFor = (type: string, row: MappedLine, expression?: string | null): string => {
  switch (type) {
    case "mark-seal":
      return "The line is written completely and its mark is awarded";
    case "math-vault":
      return vaultCondition(expression ?? row.vaultExpression);
    case "time-shard":
      return row.timerSeconds
        ? `The line is completed before its own ${row.timerSeconds}s runs out`
        : "This line has no line time";
    case "retry-heart":
      return "The line is completed — the Life is stored, not spent";
    case "math-core":
    case "premium-chain-bomb":
      return "A bomb reaches it — activation only, it never converts";
    case "horizontal-collector":
      return "A sweep along its row reaches it — activation only";
    case "vertical-collector":
      return "A sweep down its column reaches it — activation only";
    default:
      return "Activation only";
  }
};

export const buildLineReport = (input: {
  row: MappedLine;
  questionRowId: string;
  expected: string | null;
  student: string;
  note: string | null;
  lineMarks: number;
  awarded: boolean;
  consumedRewardKeys: readonly string[];
  verdict?: InspectVerdict | null;
  prediction?: InspectPrediction | null;
  /** True once a proved-complete line has still not been marked after the
   *  short grace window — only then is "score pending" a real inconsistency. */
  awardGraceElapsed?: boolean;
  /** The Game Line whose Hourglass is counting right now. */
  timedLine: number | null;
  hourglassToTime: number;
  lifeToTime: number;
}): LineReport => {
  const { row, questionRowId, student, awarded } = input;
  const status = deriveMathStatus({
    isQuestion: row.isQuestion,
    expected: input.expected,
    student,
    awarded,
    verdict: input.verdict,
    prediction: input.prediction,
  });
  const consumed = (rewardId: string) =>
    input.consumedRewardKeys.includes(`${questionRowId}:${row.line}:${rewardId}`);

  const rewards: RewardReport[] = row.rewards.map((reward) => {
    const used = consumed(reward.id);
    const def = getReward(reward.type);
    let conditionMet = false;
    let stage: RewardStage = "waiting";
    let detail: string | undefined;

    if (reward.type === "math-vault") {
      const wanted = reward.expression ?? row.vaultExpression;
      conditionMet = used || vaultMatches(wanted, student);
      stage = used ? "awarded" : conditionMet ? "condition_met" : "waiting";
      detail = "Opening a Vault never awards the line score.";
    } else if (reward.type === "time-shard") {
      const running = input.timedLine === row.line;
      conditionMet = awarded && !used;
      if (used && !awarded) stage = "expired";
      else if (used) stage = "awarded";
      else if (running) stage = "activated";
      else stage = "waiting";
      detail = row.timerSeconds
        ? `Pays ${Math.round(row.hourglassSeconds * input.hourglassToTime)}s of Time when the line is won in time`
        : undefined;
    } else if (reward.type === "mark-seal") {
      conditionMet = awarded;
      stage = used ? "awarded" : awarded ? "condition_met" : "waiting";
    } else if (reward.type === "retry-heart") {
      conditionMet = awarded || used;
      stage = used ? "awarded" : conditionMet ? "condition_met" : "waiting";
      detail = `Becomes ${input.lifeToTime}× the Game time only when a Life is spent`;
    } else {
      conditionMet = used;
      stage = used ? "activated" : "waiting";
    }

    return {
      id: reward.id,
      type: reward.type,
      label: def.label,
      condition: conditionFor(reward.type, row, reward.expression),
      conditionMet,
      stage,
      detail,
      art: def.art,
      openArt: def.openArt,
      glow: def.glow,
      code:
        reward.type === "math-vault"
          ? (reward.expression ?? row.vaultExpression ?? null)
          : null,
    };
  });

  return {
    line: row.line,
    isQuestion: row.isQuestion,
    lineId: row.lineId,
    expected: input.expected,
    student,
    status,
    lineMarks: input.lineMarks,
    scoreAwarded: awarded,
    scoreInconsistent: status === "equivalent" && !awarded && input.awardGraceElapsed === true,
    hasNote: Boolean(clean(input.note)),
    noteUnlocked: awarded && Boolean(clean(input.note)),
    rewards,
    predictive: row.isQuestion ? null : input.prediction?.predictive || null,
    remaining: row.isQuestion
      ? null
      : (input.prediction?.remaining?.length ? input.prediction.remaining.join(" ") : null),
    noRoute: !row.isQuestion && input.prediction?.status === "no_route",
    structureMissing:
      !row.isQuestion && input.prediction?.status === "incomplete_structure"
        ? input.prediction.missing ?? "finish the structure"
        : null,
    predictionComplete: !row.isQuestion && input.prediction?.complete === true,
    completionToken: row.isQuestion ? null : input.prediction?.completionToken ?? null,
  };
};

/** A short live feed. Only real events are appended, newest first. */
export interface InspectEvent {
  id: number;
  at: number;
  text: string;
}

export const MAX_EVENTS = 40;

export const appendEvent = (
  events: readonly InspectEvent[],
  text: string,
  at = Date.now(),
): InspectEvent[] => {
  if (events[0]?.text === text) return events as InspectEvent[];
  const next: InspectEvent = { id: (events[0]?.id ?? 0) + 1, at, text };
  return [next, ...events].slice(0, MAX_EVENTS);
};
