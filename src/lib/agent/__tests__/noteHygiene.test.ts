import { describe, expect, it } from "vitest";

import { cleanLine, cleanNoteLines, describeCleanup, isDirty, planCleanup, stripLabels } from "../noteHygiene";

describe("lesson-note line hygiene", () => {
  it("removes a label the page already prints", () => {
    expect(stripLabels("Solution: 2x = 10")).toBe("2x = 10");
    expect(stripLabels("Problem: Problem: Solve 2x + 7 = 12")).toBe("Solve 2x + 7 = 12");
    expect(stripLabels("Step 3: x = 5")).toBe("x = 5");
    expect(stripLabels("Solution:")).toBe("");
  });

  it("keeps mathematics untouched", () => {
    expect(cleanLine("x^2 + 5x + 6 = 0")).toBe("x^2 + 5x + 6 = 0");
    expect(cleanLine("\\frac{-b + \\sqrt{b^2 - 4ac}}{2a}")).toBe("\\frac{-b + \\sqrt{b^2 - 4ac}}{2a}");
  });

  it("turns one blob into one line per step", () => {
    expect(
      cleanNoteLines("Problem:\nProblem: Solve 2x + 7 = 12\nSolution:\n2x = 5\n\nx = 2.5\nReasoning:"),
    ).toEqual(["Solve 2x + 7 = 12", "2x = 5", "x = 2.5"]);
  });

  it("knows a clean line from a dirty one", () => {
    expect(isDirty("2x = 10")).toBe(false);
    expect(isDirty("Solution: 2x = 10")).toBe(true);
    expect(isDirty("2x = 10\nx = 5")).toBe(true);
  });

  it("plans a mend without changing anything", () => {
    const plan = planCleanup([
      { id: "a", kind: "problem", content_ascii: "Solve 2x + 7 = 12", order_index: 0 },
      { id: "b", kind: "solution", content_ascii: "Solution: 2x = 5\nx = 2.5", order_index: 1 },
      { id: "c", kind: "reasoning", content_ascii: "Reasoning:", order_index: 2 },
    ]);
    expect(plan.map((p) => p.action)).toEqual(["keep", "split", "delete"]);
    expect(describeCleanup(plan)).toContain("split");
  });
});
