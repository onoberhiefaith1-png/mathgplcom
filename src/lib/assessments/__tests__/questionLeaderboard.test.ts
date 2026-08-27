import { describe, it, expect } from "vitest";
import { buildLeaderboard } from "@/lib/assessments/questionLeaderboard";

const members = [
  { userId: "d", name: "David" },
  { userId: "s", name: "Sarah" },
  { userId: "e", name: "Emily" },
  { userId: "p", name: "Peter" },
];

describe("question leaderboard", () => {
  it("ranks best times fastest-first and lists non-starters last without a place", () => {
    const board = buildLeaderboard(members, [
      { student_id: "s", elapsed_ms: 11000, success: true },
      { student_id: "d", elapsed_ms: 20000, success: true },
      { student_id: "d", elapsed_ms: 8000, success: true },
    ]);
    expect(board.ranked.map((r) => [r.name, r.ms, r.place])).toEqual([
      ["David", 8000, 1],
      ["Sarah", 11000, 2],
    ]);
    expect(board.notStarted.map((r) => r.name)).toEqual(["Emily", "Peter"]);
  });

  it("ignores unsuccessful attempts and shares positions on ties", () => {
    const board = buildLeaderboard(members, [
      { student_id: "e", elapsed_ms: 5000, success: false },
      { student_id: "d", elapsed_ms: 9000, success: true },
      { student_id: "s", elapsed_ms: 9000, success: true },
      { student_id: "p", elapsed_ms: 12000, success: true },
    ]);
    expect(board.ranked.map((r) => r.place)).toEqual([1, 1, 3]);
    expect(board.notStarted.map((r) => r.name)).toEqual(["Emily"]);
  });
});
