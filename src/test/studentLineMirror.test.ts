// The Student Line in the Reasoning panel must mirror the SmartBoard's math
// object — never rebuild one from ASCII. These tests lock the two invariants
// that made a 2-slot fraction show up as a 4-slot fraction.

import { describe, it, expect } from "vitest";
import { collapseNestedBoxes, structureHash, mkFrac, mkBox, type Row } from "@/lib/smartboard/mathTree";

const countSlots = (row: Row): number =>
  row.reduce((acc, n) => {
    if (n.kind === "char") return acc;
    const subs = n.rows ?? [];
    return acc + subs.reduce((a, s) => a + (s.length === 0 ? 1 : countSlots(s)), 0);
  }, 0);

describe("Student Line mirrors the SmartBoard object", () => {
  it("an empty fraction has exactly two slots", () => {
    expect(countSlots([mkFrac()])).toBe(2);
  });

  it("collapses box-inside-box to one writable cell per slot", () => {
    const nested: Row = [
      { kind: "frac", rows: [[{ kind: "box", rows: [[mkBox()]] }], [mkBox()]] },
    ];
    const fixed = collapseNestedBoxes(nested);
    expect(countSlots(fixed)).toBe(2);
  });

  it("the mirrored row hashes identically to the board row", () => {
    const board: Row = [{ kind: "char", ch: "x" }, { kind: "char", ch: "=" }, mkFrac()];
    const mirrored = collapseNestedBoxes(board);
    expect(structureHash(mirrored)).toBe(structureHash(board));
  });

  it("a re-parsed copy does NOT hash the same (proving text round-trips差 differ)", () => {
    const board: Row = [mkFrac()];
    const reparsed: Row = [
      { kind: "frac", rows: [[{ kind: "bracket", left: "(", right: ")", rows: [[]] }], [{ kind: "bracket", left: "(", right: ")", rows: [[]] }]] },
    ];
    expect(structureHash(reparsed)).not.toBe(structureHash(board));
  });
});
