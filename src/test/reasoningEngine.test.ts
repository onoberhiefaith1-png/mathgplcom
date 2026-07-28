import { describe, it, expect } from "vitest";
import { ReasoningEngine, introducedTerms } from "@/lib/smartboard/reasoningEngine";

describe("reasoning engine — one active line, one truth", () => {
  it("binds a line to the row the student is writing on", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 4);
    e.bindRow(0, 5);
    expect(e.rowFor(0)).toBe(5);
    expect(e.rowFor(1)).toBeNull(); // never visited → no guess
  });

  it("does not leak one line's row into another line", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 4);
    e.end(0, "2x = 6");
    e.start(1, "L2", 6);
    expect(e.rowFor(0)).toBe(4);
    expect(e.rowFor(1)).toBe(6);
  });

  it("freezes at the End Point and never re-reads later work", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 3);
    e.end(0, "x = 2");
    e.end(0, "x = 99");
    expect(e.frozenFor(0)).toBe("x = 2");
  });

  it("restarting a line on a new row creates a new attempt and invalidates the old one", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 3);
    e.end(0, "x = 2");
    e.start(0, "L1", 9);
    expect(e.attemptFor(0)).toBe(2);
    expect(e.rowFor(0)).toBe(9);
    expect(e.frozenFor(0)).toBeUndefined();
  });

  it("continuing on the same row stays the same attempt", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 3);
    e.start(0, "L1", 3);
    expect(e.attemptFor(0)).toBe(1);
  });

  it("separates teacher-supplied items from student-introduced terms", () => {
    expect(introducedTerms("2x + 5", ["2", "x", "5"])).toEqual([]);
    expect(introducedTerms("2x + 5 + c", ["2", "x", "5"])).toEqual(["c"]);
    expect(introducedTerms("2x + 7", ["2", "x", "5"])).toEqual(["7"]);
  });

  it("clears everything on question change", () => {
    const e = new ReasoningEngine();
    e.start(0, "L1", 3);
    e.reset();
    expect(e.rowFor(0)).toBeNull();
    expect(e.active).toBeNull();
  });
});
