import { describe, expect, it } from "vitest";
import {
  isCurrentAutomaticGrade,
  PROACTIVE_GRADING_DELAY_MS,
  resultMatchesStudentLine,
  studentGradingKey,
  studentProgressSlot,
  totalSolvedMarks,
} from "../studentGrading";

describe("student-owned grading identity", () => {
  it("scopes work to question, line and exact expression", () => {
    const key = studentGradingKey("q1", 0, "5+5=10");
    expect(resultMatchesStudentLine({ expectedKey: key, questionId: "q1", lineIndex: 0, ascii: "5+5=10" })).toBe(true);
    expect(resultMatchesStudentLine({ expectedKey: key, questionId: "q2", lineIndex: 0, ascii: "5+5=10" })).toBe(false);
    expect(resultMatchesStudentLine({ expectedKey: key, questionId: "q1", lineIndex: 0, ascii: "5+5=9" })).toBe(false);
  });

  it("accepts only the latest exact line expression", () => {
    const requestKey = studentGradingKey("q1", 2, "4x+y");
    expect(isCurrentAutomaticGrade({ requestKey, questionId: "q1", lineIndex: 2, ascii: "4x+y" })).toBe(true);
    expect(isCurrentAutomaticGrade({ requestKey, questionId: "q1", lineIndex: 1, ascii: "4x+y" })).toBe(false);
    expect(isCurrentAutomaticGrade({ requestKey, questionId: "q1", lineIndex: 2, ascii: "4x+y+1" })).toBe(false);
  });

  it("coalesces input for less than one tenth of a second", () => {
    expect(PROACTIVE_GRADING_DELAY_MS).toBeLessThan(100);
  });

  it("keeps two questions independent while aggregating one assignment total", () => {
    const solved = {
      [studentProgressSlot("q1", "line-a")]: 3,
      [studentProgressSlot("q2", "line-a")]: 4,
    };
    expect(Object.keys(solved)).toEqual(["q1:line-a", "q2:line-a"]);
    expect(totalSolvedMarks(solved)).toBe(7);
  });
});