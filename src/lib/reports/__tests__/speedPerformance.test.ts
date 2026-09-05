import { describe, it, expect } from "vitest";
import {
  behindBy,
  groupTeacherRows,
  type TeacherSpeedRow,
} from "@/lib/reports/speedPerformance";

const row = (o: Partial<TeacherSpeedRow>): TeacherSpeedRow => ({
  assessmentId: "a1",
  notebookId: "n1",
  questionId: "q1",
  assignmentTitle: "Algebra Challenge",
  questionLabel: "Question 1",
  studentId: "s1",
  studentBestMs: 60000,
  overallBestMs: 45000,
  holderId: "s2",
  holderKind: "student",
  ...o,
});

describe("speed performance", () => {
  it("orders student best times fastest first", () => {
    const boards = groupTeacherRows([
      row({ studentId: "s1", studentBestMs: 63000 }),
      row({ studentId: "s2", studentBestMs: 45000 }),
      row({ studentId: "s3", studentBestMs: 52000 }),
    ]);
    expect(boards).toHaveLength(1);
    expect(boards[0]!.students.map((s) => s.studentId)).toEqual(["s2", "s3", "s1"]);
  });

  it("keeps one board per question", () => {
    const boards = groupTeacherRows([
      row({ questionId: "q1", questionLabel: "Question 1" }),
      row({ questionId: "q2", questionLabel: "Question 2" }),
    ]);
    expect(boards.map((b) => b.questionId)).toEqual(["q1", "q2"]);
  });

  it("reports the gap behind the overall best", () => {
    expect(behindBy(60000, 45000)).toBe(15000);
    expect(behindBy(45000, 45000)).toBe(0);
    expect(behindBy(45000, null)).toBeNull();
  });
});
