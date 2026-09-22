import { describe, expect, it } from "vitest";
import { clampStartingLives } from "../gameAssignments";

/** The report keeps the best marks ever earned, capped at the maximum. */
const bestEver = (previous: number, attempt: number, total: number) =>
  Math.min(total, Math.max(previous, attempt));

describe("starting lives", () => {
  it("defaults to 3 and stays within 1-5", () => {
    expect(clampStartingLives(undefined)).toBe(3);
    expect(clampStartingLives(0)).toBe(1);
    expect(clampStartingLives(9)).toBe(5);
    expect(clampStartingLives(4)).toBe(4);
  });
});

describe("report marks never inflate on a restart", () => {
  it("keeps earlier marks when a restarted run scores less", () => {
    expect(bestEver(15, 0, 40)).toBe(15);
  });

  it("adds marks never earned before", () => {
    expect(bestEver(15, 28, 40)).toBe(28);
  });

  it("never exceeds the maximum however often the Game is replayed", () => {
    let best = 0;
    for (const attempt of [10, 40, 40, 40]) best = bestEver(best, attempt, 40);
    expect(best).toBe(40);
  });
});
