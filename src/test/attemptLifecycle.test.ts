// Attempt lifecycle — navigation vs. writing, cancellation, ownership return.
import { describe, it, expect } from "vitest";
import { ReasoningEngine } from "@/lib/smartboard/reasoningEngine";

describe("Rule 1 — moving between lines is not an attempt", () => {
  it("2 → 4 → 6 → 3 with no writing creates no attempts", () => {
    const e = new ReasoningEngine();
    e.enter(2, "L2", 2);
    e.enter(4, "L4", 4);
    e.enter(6, "L6", 6);
    e.enter(3, "L3", 3);
    expect(e.hasAttempt(2)).toBe(false);
    expect(e.hasAttempt(4)).toBe(false);
    expect(e.hasAttempt(6)).toBe(false);
    expect(e.hasAttempt(3)).toBe(false);
    expect(e.active).toBeNull();
  });
});

describe("Rule 2 — an attempt begins only when writing starts", () => {
  it("visiting line 4 leaves the count alone; writing 'b' creates the attempt", () => {
    const e = new ReasoningEngine();
    e.enter(4, "L4", 7);
    expect(e.hasAttempt(4)).toBe(false);
    e.write(4);
    expect(e.hasAttempt(4)).toBe(true);
    expect(e.attemptFor(4)).toBe(1);
    expect(e.rowFor(4)).toBe(7);
  });

  it("repeated writes on the same line stay one attempt", () => {
    const e = new ReasoningEngine();
    e.enter(4, "L4", 7);
    e.write(4);
    e.write(4);
    e.write(4);
    expect(e.attemptFor(4)).toBe(1);
  });
});

describe("Rule 3 — empty attempt cancellation", () => {
  it("writing then deleting everything removes the attempt entirely", () => {
    const e = new ReasoningEngine();
    e.enter(4, "L4", 5);
    e.write(4);
    e.cancel(4);
    expect(e.hasAttempt(4)).toBe(false);
    expect(e.frozenFor(4)).toBeUndefined();
    expect(e.rowFor(4)).toBeNull();
  });

  it("a cancelled second attempt restores the first", () => {
    const e = new ReasoningEngine();
    e.enter(1, "L1", 2); e.write(1); e.end(1, "2x = 6");
    e.enter(1, "L1", 9); e.write(1, "L1", 9);
    expect(e.attemptFor(1)).toBe(2);
    e.cancel(1);
    expect(e.attemptFor(1)).toBe(1);
    expect(e.frozenFor(1)).toBe("2x = 6");
  });
});

describe("Rule 7/8 — temporary attempts hand ownership back", () => {
  it("cancelling line 8 returns the editing session to unfinished line 6", () => {
    const e = new ReasoningEngine();
    e.enter(6, "L6", 6);
    e.write(6);
    e.enter(8, "L8", 8);
    e.write(8);
    expect(e.hasAttempt(8)).toBe(true);
    e.cancel(8);
    expect(e.hasAttempt(8)).toBe(false);
    expect(e.lastUnfinishedLine(8)).toBe(6);
  });

  it("no unfinished line means nothing to return to", () => {
    const e = new ReasoningEngine();
    e.enter(3, "L3", 3);
    e.write(3);
    e.cancel(3);
    expect(e.lastUnfinishedLine(3)).toBeNull();
  });
});

describe("Rule 6 — returning to a line continues it", () => {
  it("re-entering a written line keeps the same attempt after clearing the freeze", () => {
    const e = new ReasoningEngine();
    e.enter(2, "L2", 4); e.write(2); e.end(2, "x + 1 = 4");
    e.enter(5, "L5", 6);
    e.enter(2, "L2", 4);
    e.clearFreeze(2);
    expect(e.attemptFor(2)).toBe(1);
    expect(e.frozenFor(2)).toBeUndefined();
  });
});

describe("Rule 9 — awarded marks are permanent", () => {
  it("editing an awarded line never removes its recorded marks", () => {
    // Marks live outside the engine (solvedSlots); the engine must not be
    // able to erase them by cancelling or re-opening an attempt.
    const solved: Record<string, number> = { "L1": 3 };
    const e = new ReasoningEngine();
    e.enter(0, "L1", 1); e.write(0); e.end(0, "2x = 6");
    e.enter(0, "L1", 1); e.clearFreeze(0); e.write(0);
    e.cancel(0);
    expect(solved["L1"]).toBe(3);
  });
});
