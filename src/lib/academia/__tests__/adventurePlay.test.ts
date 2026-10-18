import { describe, expect, it } from "vitest";
import { hasPassed, moveInOrder, passPctOf, pointTotalMarks, questionsForPoint, recordResult, earnedMarks, timeFillFraction } from "../adventurePlay";

const rows = [
  { id: "a", sceneId: "lp1", position: 0, totalMarks: 4 },
  { id: "b", sceneId: "lp1", position: 1, totalMarks: 6 },
  { id: "c", sceneId: "lp2", position: 0, totalMarks: 5 },
];

describe("Academia Adventure rules", () => {
  it("questions never cross learning points even when bars share a name", () => {
    expect(questionsForPoint(rows, "lp2").map((r) => r.id)).toEqual(["c"]);
  });
  it("sums marks per learning point", () => {
    expect(pointTotalMarks(rows, "lp1")).toBe(10);
  });
  it("pass mark defaults to 100%", () => {
    expect(passPctOf(null)).toBe(100);
    expect(hasPassed(9, 10, null)).toBe(false);
    expect(hasPassed(10, 10, null)).toBe(true);
  });
  it("a 70% pass mark passes at 7 of 10", () => {
    expect(hasPassed(7, 10, 70)).toBe(true);
    expect(hasPassed(6, 10, 70)).toBe(false);
  });
  it("marks count once per question", () => {
    let r = recordResult({}, "a", 4);
    r = recordResult(r, "a", 4);
    expect(earnedMarks(r)).toBe(4);
  });
  it("time bar fills from bottom and grows with an hourglass", () => {
    expect(timeFillFraction(0, 100, 50)).toBe(0.5);
    expect(timeFillFraction(0, 200, 50)).toBe(0.25);
  });
  it("reorders questions", () => {
    expect(moveInOrder(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });
});
