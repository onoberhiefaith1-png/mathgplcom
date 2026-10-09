import { describe, expect, it } from "vitest";
import {
  calculatedSubcells,
  isSubcellSolved,
  tableCellConfigOf,
  tableProgress,
  tableSurfaceLines,
} from "../tableSurface";

const grid = {
  rows: 2,
  cols: 3,
  cells: [["5", "-3", "9"], ["7", "-1", "1"]],
  subcells: {
    "0:1": { expr: "5 - 8" }, "0:2": { expr: "(-3)^2" },
    "1:1": { expr: "7 - 8" }, "1:2": { expr: "(-1)^2" },
  },
};

describe("table writing surface", () => {
  it("a table's lines become one surface", () => {
    const { anchors, hidden, lineAnchors } = tableSurfaceLines([null, "t1", "t1", "t1", null]);
    expect([...anchors.entries()]).toEqual([[2, "t1"]]);
    expect([...hidden]).toEqual([3, 4]);
    expect([...lineAnchors.entries()]).toEqual([[2, 2], [3, 2], [4, 2]]);
  });

  it("raw data cells get no coin; calculated Subcells default to 1 mark and a coin", () => {
    expect(calculatedSubcells(grid)).toEqual(["0:1", "0:2", "1:1", "1:2"]);
    expect(calculatedSubcells(grid)).not.toContain("0:0");
    expect(tableCellConfigOf(undefined)).toEqual({ marks: 1, coin: true, vault: false });
  });

  it("a correct Subcell is solved", () => {
    expect(isSubcellSolved(grid, { "sub:0:1": "5 - 8", "0:1": "-3" }, "0:1")).toBe(true);
  });

  it("copying the answer without working earns nothing", () => {
    expect(isSubcellSolved(grid, { "0:1": "-3" }, "0:1")).toBe(false);
  });

  it("wrong working does not count", () => {
    expect(isSubcellSolved(grid, { "sub:0:1": "5 - 7", "0:1": "-3" }, "0:1")).toBe(false);
  });

  it("progress counts solved calculations", () => {
    const entries = { "sub:0:1": "5 - 8", "0:1": "-3", "sub:1:1": "7-8", "1:1": "-1" };
    expect(tableProgress(grid, entries)).toEqual({ done: 2, total: 4 });
  });
});
