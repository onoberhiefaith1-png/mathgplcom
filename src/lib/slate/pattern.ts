// The Game's Lines are a REPEATING REWARD PATTERN, nothing more.
//
//   Question Line (Line 0) — read-only, outside the pattern, no rewards.
//   Game Line N (N >= 1)   — Floating Numbers Line N, reward pattern slot
//                            ((N - 1) mod patternLength) + 1.
//
// Empty pattern positions stay empty: nothing is ever auto-inserted.

import type { Game, RewardInstance } from "./types";

/** The Question Line always sits at index 0 and never takes a pattern slot. */
export const QUESTION_LINE = 0;

/** How many Lines the teacher's reward pattern is long. */
export const patternLengthOf = (game: Pick<Game, "slots" | "patternLength">): number => {
  const declared = Number(game.patternLength);
  if (Number.isFinite(declared) && declared > 0) {
    return Math.min(Math.floor(declared), game.slots.length);
  }
  return game.slots.length;
};

/** Zero-based pattern slot used by Game Line `lineNumber` (1-based). */
export const patternSlotIndex = (lineNumber: number, patternLength: number): number => {
  if (patternLength <= 0 || lineNumber < 1) return -1;
  return (lineNumber - 1) % patternLength;
};

/** Rewards shown on Game Line `lineNumber`. Line 0 (the Question) has none. */
export const rewardsForLine = (
  game: Pick<Game, "slots" | "patternLength">,
  lineNumber: number,
): RewardInstance[] => {
  const index = patternSlotIndex(lineNumber, patternLengthOf(game));
  if (index < 0) return [];
  return game.slots[index]?.rewards ?? [];
};

export interface MappedLine {
  /** 0 = the Question Line, 1..n = solving Lines. */
  line: number;
  isQuestion: boolean;
  /** Which pattern position this Line borrows, 1-based. 0 for the Question. */
  patternSlot: number;
  rewards: RewardInstance[];
  /** Seconds on this Floating Numbers line, when the teacher set one. */
  timerSeconds: number | null;
}

/**
 * The complete Line map a question produces inside this Game: Line 0 plus one
 * Line per Floating Numbers line, each carrying its pattern rewards and any
 * Timer Reward the Floating Numbers line itself declares.
 */
export const mapQuestionLines = (
  game: Pick<Game, "slots" | "patternLength">,
  lineTimers: (number | null | undefined)[],
): MappedLine[] => {
  const patternLength = patternLengthOf(game);
  const rows: MappedLine[] = [
    { line: QUESTION_LINE, isQuestion: true, patternSlot: 0, rewards: [], timerSeconds: null },
  ];
  lineTimers.forEach((seconds, i) => {
    const line = i + 1;
    const raw = Number(seconds);
    rows.push({
      line,
      isQuestion: false,
      patternSlot: patternSlotIndex(line, patternLength) + 1,
      rewards: rewardsForLine(game, line),
      timerSeconds: Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null,
    });
  });
  return rows;
};
