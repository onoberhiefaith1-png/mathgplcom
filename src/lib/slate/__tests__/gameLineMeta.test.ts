import { describe, expect, it } from "vitest";
import { alignGameLineMeta } from "../gameLineMeta";
import { mapQuestionLines } from "../pattern";

const game = { slots: [{ id: "s", rewards: [] }], patternLength: 1 } as never;
const board = (ids: string[]) => ids.map((lineId) => ({ lineId }));

describe("Game surfaces follow the board's number lines one-to-one", () => {
  it("gives five number lines five distinct solution surfaces plus the question surface", () => {
    // The authored lesson note only has three lines now; the assigned copy has five.
    const meta = alignGameLineMeta(board(["a", "b", "c", "d", "e"]), [
      { lineId: "a", timerSeconds: 30 },
      { lineId: "c" },
      { lineId: "e", timerSeconds: 10 },
    ]);
    expect(meta.lineTimers).toEqual([30, null, null, null, 10]);
    const lines = mapQuestionLines(game, meta.lineTimers, ["a", "b", "c", "d", "e"], meta.lineVaults);
    expect(lines.map((l) => l.line)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(lines[0].isQuestion).toBe(true);
    expect(lines.slice(1).map((l) => l.lineId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(new Set(lines.map((l) => l.line)).size).toBe(6);
  });

  it("keeps repeated and empty lines as their own surfaces", () => {
    const meta = alignGameLineMeta(board(["x1", "x2", "n1", "x3"]), [
      { lineId: "x1", equation: "x = 2" },
      { lineId: "x2", equation: "x = 2" },
      { lineId: "n1", equation: "" },
      { lineId: "x3", equation: "x = 2" },
    ]);
    expect(meta.lineTimers).toHaveLength(4);
    expect(mapQuestionLines(game, meta.lineTimers, ["x1", "x2", "n1", "x3"])).toHaveLength(5);
  });

  it("joins by identity, not position, when a note line compiles in between", () => {
    const meta = alignGameLineMeta(board(["l1", "note", "l2"]), [
      { lineId: "l1", timerSeconds: 5 },
      { lineId: "l2", timerSeconds: 9 },
    ]);
    expect(meta.lineTimers).toEqual([5, null, 9]);
  });
});
