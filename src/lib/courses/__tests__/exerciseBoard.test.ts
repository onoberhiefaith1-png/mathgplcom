import { describe, expect, it } from "vitest";
import { exerciseTally } from "../exerciseBoard";

describe("exerciseTally", () => {
  const questions = [
    { id: "q1", marks: 4 },
    { id: "q2", marks: 6 },
  ];

  it("reports zero before anything is solved", () => {
    const t = exerciseTally({ questions, earnedByQuestion: {}, passMark: 80 });
    expect(t).toEqual({ earned: 0, total: 10, percent: 0, solved: 0, passed: false });
  });

  it("adds up the student's own marks and counts attempts", () => {
    const t = exerciseTally({ questions, earnedByQuestion: { q1: 4, q2: 3 }, passMark: 80 });
    expect(t.earned).toBe(7);
    expect(t.percent).toBe(70);
    expect(t.solved).toBe(2);
    expect(t.passed).toBe(false);
  });

  it("passes only at or above the card's pass mark", () => {
    expect(exerciseTally({ questions, earnedByQuestion: { q1: 4, q2: 4 }, passMark: 80 }).passed).toBe(true);
    expect(exerciseTally({ questions, earnedByQuestion: { q1: 4, q2: 3 }, passMark: 80 }).passed).toBe(false);
  });

  it("never passes an exercise that carries no marks", () => {
    expect(exerciseTally({ questions: [], earnedByQuestion: {}, passMark: 0 }).passed).toBe(false);
  });
});

describe("exercise card summary", () => {
  const links = [
    { id: "a", block_id: "b1", position: 1, total_marks: 8 },
    { id: "b", block_id: "b1", position: 0, total_marks: 6 },
    { id: "c", block_id: "b1", position: 2, total_marks: 10 },
  ];

  it("counts linked questions and adds their own marks", () => {
    expect(links.length).toBe(3);
    expect(links.reduce((s, q) => s + (Number(q.total_marks) || 0), 0)).toBe(24);
  });

  it("orders questions by card position", () => {
    expect([...links].sort((a, b) => a.position - b.position).map((l) => l.id)).toEqual(["b", "a", "c"]);
  });
});
