import { describe, expect, it } from "vitest";
import { withSolution } from "../core";
import { allRequiredLinesAwarded } from "@/lib/game/runtime/completion";

describe("MCQ solution link", () => {
  const qs = [{ n: 1, text: "Q1", options: [], answer: "A" }, { n: 2, text: "Q2", options: [], answer: "B" }];
  it("links to the existing question and keeps its text", () => {
    const out = withSolution(qs, 2, { lines: [{ equation: "x=1" }] });
    expect(out[1].text).toBe("Q2");
    expect(out[1].solution?.lines).toHaveLength(1);
    expect(out[0].solution).toBeUndefined();
  });
  it("replaces an earlier link", () => {
    const once = withSolution(qs, 1, { lines: [{ equation: "a" }] });
    expect(withSolution(once, 1, { lines: [{ equation: "b" }, { equation: "c" }] })[0].solution?.lines).toHaveLength(2);
  });
});

describe("Question completion", () => {
  it("never completes while the last line (worth marks) is unsolved, even without chips", () => {
    const q = { questionRowId: "q", lineIds: ["a", "b"], lineHasFloatingNumbers: [true, false], lineMarks: [1, 1] };
    expect(allRequiredLinesAwarded(q, ["q:a"])).toBe(false);
    expect(allRequiredLinesAwarded(q, ["q:a", "q:b"])).toBe(true);
  });
});
