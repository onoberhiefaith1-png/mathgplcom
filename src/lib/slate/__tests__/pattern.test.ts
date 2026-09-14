import { describe, expect, it } from "vitest";
import {
  mapQuestionLines,
  patternLengthOf,
  patternSlotIndex,
  rewardsForLine,
} from "../pattern";
import type { Game, RewardInstance, Slot } from "../types";

const reward = (type: string): RewardInstance => ({
  id: `${type}-${Math.random()}`,
  type,
  state: "dormant",
  hidden: false,
  x: 50,
  y: 50,
});

const slot = (rewards: RewardInstance[]): Slot =>
  ({ id: Math.random().toString(36).slice(2), text: "", hiddenContent: "", contentState: "hidden", rewards, scene: {} } as unknown as Slot);

/** Pattern: 1 → 2 coins, 2 → coin, 3 → life, 4 → empty, 5 → coin. */
const game = {
  patternLength: 5,
  slots: [
    slot([reward("math-coin"), reward("math-coin")]),
    slot([reward("math-coin")]),
    slot([reward("retry-heart")]),
    slot([]),
    slot([reward("math-coin")]),
  ],
} as Pick<Game, "slots" | "patternLength">;

describe("reward pattern", () => {
  it("uses the declared pattern length", () => {
    expect(patternLengthOf(game)).toBe(5);
    expect(patternLengthOf({ slots: game.slots, patternLength: 0 })).toBe(5);
  });

  it("repeats by position", () => {
    expect(patternSlotIndex(1, 5)).toBe(0);
    expect(patternSlotIndex(6, 5)).toBe(0);
    expect(patternSlotIndex(11, 5)).toBe(0);
    expect(patternSlotIndex(7, 5)).toBe(1);
  });

  it("gives repeated Lines the same rewards", () => {
    expect(rewardsForLine(game, 1)).toHaveLength(2);
    expect(rewardsForLine(game, 6)).toHaveLength(2);
    expect(rewardsForLine(game, 11)).toHaveLength(2);
    expect(rewardsForLine(game, 3)[0]!.type).toBe("retry-heart");
    expect(rewardsForLine(game, 8)[0]!.type).toBe("retry-heart");
  });

  it("keeps empty positions empty when they repeat", () => {
    expect(rewardsForLine(game, 4)).toHaveLength(0);
    expect(rewardsForLine(game, 9)).toHaveLength(0);
    expect(rewardsForLine(game, 14)).toHaveLength(0);
  });

  it("gives the Question Line no rewards and no pattern slot", () => {
    expect(rewardsForLine(game, 0)).toHaveLength(0);
    const rows = mapQuestionLines(game, [null, null, null]);
    expect(rows[0]!.isQuestion).toBe(true);
    expect(rows[0]!.patternSlot).toBe(0);
    expect(rows[0]!.rewards).toHaveLength(0);
  });

  it("does not shift the pattern because of the Question Line", () => {
    const rows = mapQuestionLines(game, Array(7).fill(null));
    expect(rows).toHaveLength(8);
    expect(rows[1]!.line).toBe(1);
    expect(rows[1]!.patternSlot).toBe(1);
    expect(rows[6]!.patternSlot).toBe(1);
    expect(rows[7]!.patternSlot).toBe(2);
  });

  it("carries the Floating Numbers line timer through as the Timer Reward", () => {
    const rows = mapQuestionLines(game, [null, null, null, 10, null]);
    expect(rows.find((r) => r.line === 4)!.timerSeconds).toBe(10);
    expect(rows.filter((r) => r.timerSeconds !== null)).toHaveLength(1);
  });

  it("shorter questions use only the first pattern positions", () => {
    const rows = mapQuestionLines(game, Array(2).fill(null));
    expect(rows.map((r) => r.patternSlot)).toEqual([0, 1, 2]);
  });
});
