import { describe, expect, it } from "vitest";
import {
  questionsForBoard,
  sortForTeacher,
  unansweredCount,
  type AssessmentStudentQuestion,
} from "../studentQuestions";

const q = (over: Partial<AssessmentStudentQuestion>): AssessmentStudentQuestion => ({
  id: "1",
  assessmentId: "a",
  classId: "c",
  studentUserId: "s",
  boardQuestionId: null,
  body: "why?",
  answerBody: null,
  answeredAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("assessment student questions", () => {
  it("puts unanswered questions first, newest first", () => {
    const rows = [
      q({ id: "old-answered", answerBody: "yes", createdAt: "2026-01-05T00:00:00Z" }),
      q({ id: "older-open", createdAt: "2026-01-02T00:00:00Z" }),
      q({ id: "newest-open", createdAt: "2026-01-06T00:00:00Z" }),
    ];
    expect(sortForTeacher(rows).map((r) => r.id)).toEqual(["newest-open", "older-open", "old-answered"]);
  });

  it("counts only questions with no answer", () => {
    expect(unansweredCount([q({ id: "1" }), q({ id: "2", answerBody: "ok" })])).toBe(1);
  });

  it("scopes the student thread to the board question they are on", () => {
    const rows = [
      q({ id: "here", boardQuestionId: "bq-1" }),
      q({ id: "elsewhere", boardQuestionId: "bq-2" }),
      q({ id: "legacy", boardQuestionId: null }),
    ];
    expect(questionsForBoard(rows, "bq-1").map((r) => r.id)).toEqual(["here", "legacy"]);
    expect(questionsForBoard(rows, null).map((r) => r.id)).toHaveLength(3);
  });

  it("orders the student thread oldest first so answers read in sequence", () => {
    const rows = [
      q({ id: "second", createdAt: "2026-02-02T00:00:00Z" }),
      q({ id: "first", createdAt: "2026-02-01T00:00:00Z" }),
    ];
    expect(questionsForBoard(rows, null).map((r) => r.id)).toEqual(["first", "second"]);
  });
});
