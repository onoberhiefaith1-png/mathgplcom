// TBL-002 — a table opens a branch Tk whose children are Tk.1, Tk.2 …, and
// branch numbering never renumbers the main L-sequence.
import { describe, expect, it } from "vitest";
import {
  buildTableGroups,
  branchTagFor,
  lessonSteps,
  nextMainStepAfter,
  stepIdxForLine,
  tagForLine,
  tSeriesFor,
} from "@/lib/smartboard/tableActivity";

type Line = Parameters<typeof buildTableGroups>[0][number];

const grid = (label: string) => ({ label, rows: 2, cols: 2, cells: {} }) as never;

const plain = (text: string): Line => ({ text } as unknown as Line);
const tableLine = (objId: string, label: string): Line =>
  ({
    text: label,
    table: { objId, label, grid: grid(label), orientation: "row", retained: [] },
  }) as unknown as Line;

// L1, T1.1, T1.2, L2, T2.1, T2.2, L3
const lines: Line[] = [
  plain("2x + 4 = 10"),
  tableLine("t1", "Table 1"),
  tableLine("t1", "Table 1"),
  plain("x = 3"),
  tableLine("t2", "Table 2"),
  tableLine("t2", "Table 2"),
  plain("Answer"),
];

describe("table branch numbering (TBL-002)", () => {
  const groups = buildTableGroups(lines);
  const steps = lessonSteps(lines.length, groups);

  it("gives each table one branch, numbered in order", () => {
    expect(groups).toHaveLength(2);
    expect(branchTagFor(groups[0])).toBe("T1");
    expect(branchTagFor(groups[1])).toBe("T2");
  });

  it("numbers branch children Tk.1, Tk.2 …", () => {
    expect(tSeriesFor(groups[0]).map((s) => s.label)).toEqual(["T1.1", "T1.2"]);
    expect(tSeriesFor(groups[1]).map((s) => s.label)).toEqual(["T2.1", "T2.2"]);
    expect(tagForLine(steps, groups, 1)).toBe("T1.1");
    expect(tagForLine(steps, groups, 5)).toBe("T2.2");
  });

  it("does not renumber the main sequence: L1, L2, L3 survive both branches", () => {
    expect(tagForLine(steps, groups, 0)).toBe("L1");
    expect(tagForLine(steps, groups, 3)).toBe("L2");
    expect(tagForLine(steps, groups, 6)).toBe("L3");
  });

  it("returns to the next main step at the end of a branch", () => {
    const next = nextMainStepAfter(steps, groups[0]);
    expect(next).not.toBeNull();
    expect(stepIdxForLine(steps, 2)).toBe(stepIdxForLine(steps, 1));
    expect(tagForLine(steps, groups, (next as { lineIdx: number }).lineIdx)).toBe("L2");
  });

  it("keeps one branch even when a table's lines are not contiguous", () => {
    const split = buildTableGroups([
      tableLine("t1", "Table 1"),
      plain("middle"),
      tableLine("t1", "Table 1"),
    ]);
    expect(split).toHaveLength(1);
    expect(split[0].memberLineIdxs).toEqual([0, 2]);
  });
});
