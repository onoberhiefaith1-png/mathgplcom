import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { studentProgressSlot, totalSolvedMarks } from "../studentGrading";

describe("student marking is never gated", () => {
  it("grade-line carries no credit gate", () => {
    const src = readFileSync("supabase/functions/grade-line/index.ts", "utf8");
    expect(src).not.toContain("meterFunction(");
    expect(src).toContain("withUsageMeter(");
  });
});

describe("marks aggregate across questions", () => {
  it("keeps each question's lines in their own slot and sums them", () => {
    const solved: Record<string, number> = {};
    solved[studentProgressSlot("q1", "l1")] = 4;
    solved[studentProgressSlot("q2", "l1")] = 3;
    expect(Object.keys(solved)).toHaveLength(2);
    expect(totalSolvedMarks(solved)).toBe(7);
  });
});
