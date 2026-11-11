import { describe, expect, it } from "vitest";
import { parseInlineMcq } from "../inlineMcq";

describe("supplied single-question MCQs", () => {
  it("preserves options and the teacher's declared answer without solving", () => {
    const q = parseInlineMcq("What is the constant term in 4x + 7?\nA. −7\nB. 7\nC. 4x\nD. 4\nCorrect Answer: B");
    expect(q).toEqual({ text: "What is the constant term in 4x + 7?", options: [
      { label: "A", text: "−7" }, { label: "B", text: "7" }, { label: "C", text: "4x" }, { label: "D", text: "4" },
    ], answer: "B" });
  });
  it("accepts inline choices and the spoken correct-answer form", () => {
    expect(parseInlineMcq("Find x.\nA) −7  B) 7  C) 4x  D) 4\nCorrect answer is D")?.answer).toBe("D");
  });
  it.each([
    "Find x.\nA. 1\nB. 2", "Find x.\nA. 1\nB. 2\nCorrect Answer: C",
    "Find x.\nA. 1\nA. 2\nCorrect Answer: A", "Find x.\nA. 1\nB. 2\nCorrect Answer: A\nCorrect Answer: B",
    "Find x.\nSolution\nx = 7", "Question 1\nFind x.\nA. 1\nB. 2\nCorrect Answer: A\nQuestion 2\nFind y.",
  ])("does not guess for incomplete, ambiguous, worked, or multiple questions", source => {
    expect(parseInlineMcq(source)).toBeNull();
  });
});
