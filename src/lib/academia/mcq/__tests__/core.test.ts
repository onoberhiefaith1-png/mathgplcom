import { describe, expect, it } from "vitest";
import { markPaper, parseMcq, statusOf } from "../core";
import { forcedMcqToQuestion, parseForcedMcq } from "@/lib/lessonnotes/forcedAssign";

const lines = [
  "Question 1", "Solve 2x + 5 = 15.", "A. x = 3", "B. x = 5", "C. x = 7", "D. x = 10", "Correct Answer: B",
  "Question 2", "Which is prime?", "A. 9   B. 15   C. 17   D. 21", "Answer: C",
  "Question 3", "Simplify 3(x - 2).", "A. 3x - 6", "B. 3x - 1",
];

describe("multiple-choice papers", () => {
  it("detects questions, options and answers", () => {
    const { questions } = parseMcq(lines);
    expect(questions).toHaveLength(3);
    expect(questions[0].answer).toBe("B");
    expect(questions[1].options.map((o) => o.label)).toEqual(["A", "B", "C", "D"]);
    expect(questions[1].answer).toBe("C");
  });
  it("flags a question with no answer", () => {
    const { issues } = parseMcq(lines);
    expect(issues).toEqual([{ n: 3, message: "has no correct answer" }]);
  });
  it("keeps original question numbers in each result group", () => {
    const { questions } = parseMcq(lines);
    const r = markPaper(questions, { 1: "A", 2: "C" });
    expect(r.groups).toEqual({ correct: [2], incorrect: [1], unanswered: [], ungraded: [3] });
    expect(r.percent).toBe(50);
    expect(r.total).toBe(2);
  });

  it("does not grade a picked option when the paper has no confirmed answer", () => {
    const questions = [forcedMcqToQuestion(parseForcedMcq("What is 2 + 2?\nA. 3\nB. 4\nC. 5"))];
    expect(statusOf(questions[0]!, { 1: "B" })).toBe("ungraded");
    const r = markPaper(questions, { 1: "B" });
    expect(r.groups.ungraded).toEqual([1]);
    expect(r.correct).toBe(0);
    expect(r.incorrect).toBe(0);
    expect(r.total).toBe(0);
    expect(r.percent).toBe(0);
  });
});
