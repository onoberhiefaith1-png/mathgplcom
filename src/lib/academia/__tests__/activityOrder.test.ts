import { describe, expect, it } from "vitest";
import { pickNeighbours } from "../activityOrder";

const rows = [
  { id: "a", assessment_id: "x", game_id: "g" },
  { id: "b", assessment_id: "y", game_id: null },
  { id: "c", assessment_id: "z", game_id: "g2" },
];

describe("Academia activity chain", () => {
  it("Play continues to the next activity that has a Game", () => {
    expect(pickNeighbours(rows, "a", "play").next?.id).toBe("c");
  });
  it("the last Play has no next", () => {
    expect(pickNeighbours(rows, "c", "play").next).toBeNull();
  });
  it("Practice steps through every activity with a question", () => {
    const n = pickNeighbours(rows, "b", "practice");
    expect([n.prev?.id, n.next?.id, n.index, n.total]).toEqual(["a", "c", 1, 3]);
  });
});
