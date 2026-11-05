import { describe, expect, it } from "vitest";
import { spliceSolution } from "../../flexibleSolution";
import { noteRowBelowOwned } from "../notePlacement";

describe("Smartboard teaching-note placement", () => {
  it("inserts the note on the next whole row under a plain equation", () => {
    const start = noteRowBelowOwned([4], () => false);
    expect(start).toBe(5);
    const after = spliceSolution(
      {
        ink: { 4: "3y - 5 = 10", 5: "3y = 15" },
        offsets: {},
        owners: { 4: 0, 5: 1 },
        locked: new Set<number>(),
      },
      start!,
      0,
      { [start!]: "Add 5 to both sides." },
      20,
    );
    expect(after.ink).toEqual({
      4: "3y - 5 = 10",
      5: "Add 5 to both sides.",
      6: "3y = 15",
    });
    expect([...after.locked]).toEqual([5]);
  });

  it("clears a tall structure without using its half-row as the splice index", () => {
    const start = noteRowBelowOwned([4, 4.5], (floor) => floor === 4);
    expect(start).toBe(6);
    expect(Number.isInteger(start)).toBe(true);
    const after = spliceSolution(
      {
        ink: { 4: "fraction", 4.5: "denominator", 6: "next line" },
        offsets: {},
        owners: { 4: 0, 6: 1 },
        locked: new Set<number>(),
      },
      start!,
      0,
      { [start!]: "Cancel the denominator." },
      20,
    );
    expect(after.ink[4]).toBe("fraction");
    expect(after.ink[4.5]).toBe("denominator");
    expect(after.ink[6]).toBe("Cancel the denominator.");
    expect(after.ink[7]).toBe("next line");
  });

  it("does not invent a row when the line has not been written yet", () => {
    expect(noteRowBelowOwned([], () => false)).toBeNull();
  });
});
