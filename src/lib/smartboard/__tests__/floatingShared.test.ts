// The live classroom floating number is ONE shared object with real identity.
// These tests lock the two failures reported from the classroom board:
//   * the student's arrangement drifted from the teacher's, and
//   * an operation on one line changed another line.
import { describe, expect, it } from "vitest";
import {
  buildFloatingLines,
  chipIdsForAbsIdx,
  lineIdOfChip,
  reservoirFromShared,
  sharedConsumedSet,
  sharedUsedOrderIdx,
} from "@/lib/smartboard/floatingShared";
import type { FloatingShared } from "@/hooks/useSmartboardSync";
import type { Reservoir } from "@/lib/smartboard/presentation";

const reservoir = (): Reservoir => ({
  beatId: "q1",
  caption: "Solve",
  // Line 1: 2 4 6 8   Line 2: 1 3 5 7  (line 2 repeats no value of line 1,
  // but chips still must never be addressed by value or position alone)
  fragments: ["2", "4", "6", "8", "1", "3", "5", "7"],
  lines: [
    { equation: "2+4+6+8", fillers: [], containers: [], fragmentStart: 0, fragmentEnd: 4 },
    { equation: "1+3+5+7", fillers: [], containers: [], fragmentStart: 4, fragmentEnd: 8 },
  ],
});

const shared = (): FloatingShared => {
  const lines = buildFloatingLines("q1", reservoir());
  return {
    resId: "q1",
    viewIdx: 0,
    activeIdx: 0,
    lineIdx: 0,
    lines,
    usedOrder: [],
    reveal: 0,
    offset: 0,
    reentryOffset: 0,
  };
};

describe("shared floating workspace", () => {
  it("gives every chip and line its own identity", () => {
    const lines = buildFloatingLines("q1", reservoir());
    const ids = lines.flatMap((l) => l.chips.map((c) => c.chipId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(lines.map((l) => l.lineId)).size).toBe(2);
  });

  it("chips of equal value on different lines are different objects", () => {
    const res = reservoir();
    res.fragments = ["5", "5", "5", "5", "5", "5", "5", "5"];
    const lines = buildFloatingLines("q1", res);
    const a = lines[0].chips[0].chipId;
    const b = lines[1].chips[0].chipId;
    expect(a).not.toBe(b);
  });

  it("keeps a saved line's chip ids stable when a preceding line grows", () => {
    const before = reservoir();
    before.lines[0].lineId = "first";
    before.lines[1].lineId = "second";
    const beforeSecond = buildFloatingLines("q1", before).find((line) => line.lineId === "second");

    const after = reservoir();
    after.fragments = ["0", ...after.fragments];
    after.lines[0] = { ...after.lines[0], lineId: "first", fragmentStart: 0, fragmentEnd: 5 };
    after.lines[1] = { ...after.lines[1], lineId: "second", fragmentStart: 5, fragmentEnd: 9 };
    const afterSecond = buildFloatingLines("q1", after).find((line) => line.lineId === "second");

    expect(beforeSecond?.chips.map((chip) => chip.chipId)).toEqual(
      afterSecond?.chips.map((chip) => chip.chipId),
    );
  });

  it("the receiver reproduces the publisher's exact arrangement", () => {
    const s = shared();
    const rebuilt = reservoirFromShared(s, reservoir());
    expect(rebuilt.fragments).toEqual(["2", "4", "6", "8", "1", "3", "5", "7"]);
    expect(rebuilt.lines.map((l) => [l.fragmentStart, l.fragmentEnd])).toEqual([[0, 4], [4, 8]]);
  });

  it("using chips on line 1 never marks anything on line 2", () => {
    const s = shared();
    // Teacher uses the 2nd and 4th chip of line 1.
    s.usedOrder = chipIdsForAbsIdx(s.lines, [1, 3]);
    const consumed = sharedConsumedSet(s, s.usedOrder);
    expect([...consumed].sort()).toEqual([1, 3]);
    // Nothing from line 2 (positions 4..7) is touched.
    expect([...consumed].every((i) => i < 4)).toBe(true);
    for (const id of s.usedOrder) expect(lineIdOfChip(s, id)).toBe(s.lines[0].lineId);
  });

  it("preserves the exact use order for the used zone", () => {
    const s = shared();
    s.usedOrder = chipIdsForAbsIdx(s.lines, [6, 4, 5]);
    expect(sharedUsedOrderIdx(s, s.usedOrder)).toEqual([6, 4, 5]);
  });

  it("ignores chip ids that are not part of the shared arrangement", () => {
    const s = shared();
    expect(sharedConsumedSet(s, ["someone-elses-chip"]).size).toBe(0);
  });
});
