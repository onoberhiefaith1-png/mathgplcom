import { describe, expect, it } from "vitest";
import { verifySessionStructure } from "../../../../supabase/functions/notebook-ai/sessionStructureVerifier";

describe("Solution is a session", () => {
  it("passes paired Question → Solution sessions", () => {
    const t = "## Explanation\nMean is average.\n## Classwork 1\nSolve 2x+5=15\n## Solution 1\n2x+5=15\n2x=10\nx=5\n## Homework 1\nFind x: x+3=7\n## Solution 1\nx+3=7\nx=4\n## Summary\nDone";
    const r = verifySessionStructure(t);
    expect(r.defects).toEqual([]);
    expect(r.stats.paired).toBe(2);
  });
  it("rejects questions without Solution sessions", () => {
    const r = verifySessionStructure("## Classwork 1\nQ1\n## Classwork 2\nQ2");
    expect(r.stats.missing).toBe(2);
  });
  it("rejects all-questions-then-all-solutions", () => {
    const r = verifySessionStructure("## Classwork 1\nQ1\n## Classwork 2\nQ2\n## Solution 1\na\n## Solution 2\nb");
    expect(r.defects.some((d) => d.includes("in a row"))).toBe(true);
  });
  it("rejects mismatched numbering", () => {
    const r = verifySessionStructure("## Classwork 2\nQ\n## Solution 7\nx=1");
    expect(r.defects.some((d) => d.includes("numbering"))).toBe(true);
  });
  it("rejects a solution embedded in the question session", () => {
    const r = verifySessionStructure("## Example 1\nSolve x+1=2\nSolution:\nx=1\n## Solution 1\nx=1");
    expect(r.defects.some((d) => d.includes("inside"))).toBe(true);
  });
  it("does not require solutions for explanation-only content", () => {
    expect(verifySessionStructure("## Explanation\nA frequency table shows counts.").defects).toEqual([]);
  });
});
