import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { awardedForLine } from "../awardedForLine";
import { buildInstantAward } from "@/lib/predictive/instantAward";

describe("Evaluation panel awarded marks match the board", () => {
  const slot = "q:l1";
  it("a test sitting (no saved progress) shows the board's instant award, not 0/2", () => {
    const check = buildInstantAward({ questionId: "q", lineId: "l1", marks: 2, ascii: "2^5 = 2×2×2×2×2" });
    expect(awardedForLine({ slot, savedSolved: null, check, lineMarks: 2 })).toBe(2);
  });
  it("saved progress still counts", () => {
    expect(awardedForLine({ slot, savedSolved: { [slot]: 2 }, check: null, lineMarks: 2 })).toBe(2);
  });
  it("a wrong verdict never shows marks", () => {
    expect(awardedForLine({ slot, savedSolved: null, check: { correct: false, marks: 2 }, lineMarks: 2 })).toBe(0);
  });
  it("never more than the line is worth", () => {
    expect(awardedForLine({ slot, savedSolved: null, check: { correct: true, marks: 9 }, lineMarks: 2 })).toBe(2);
  });
  it("TeacherEvaluationPanel uses it", () => {
    const src = readFileSync(resolve(__dirname, "../../../components/smartboard/TeacherEvaluationPanel.tsx"), "utf8");
    expect(src).toMatch(/awardedForLine\(\{/);
  });
});
