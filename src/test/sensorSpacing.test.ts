// Regression: "the notation decides" — a finished plain equation must NOT
// reserve phantom rows below it. Only genuinely tall structures (stacked
// fractions, matrices, big operators, binomials) reserve space.
import { describe, it, expect } from "vitest";
import {
  rowHasTallStructure,
  mkChar,
  mkFrac,
  mkSup,
  mkSqrt,
  mkBracket,
  mkMatrix,
  mkBigOp,
  type Row,
  type Node,
} from "@/lib/smartboard/mathTree";

const chars = (s: string): Row => [...s].map(mkChar);

describe("rowHasTallStructure — the notation decides", () => {
  it("plain equation x + y = 7 (1) is NOT tall", () => {
    expect(rowHasTallStructure(chars("x+y=7(1)"))).toBe(false);
  });

  it("superscript x² is NOT tall", () => {
    const sup = mkSup() as Extract<Node, { kind: "sup" }>;
    sup.rows[0] = chars("2");
    expect(rowHasTallStructure([mkChar("x"), sup])).toBe(false);
  });

  it("simple square root is NOT tall", () => {
    const sq = mkSqrt() as Extract<Node, { kind: "sqrt" }>;
    sq.rows[0] = chars("49");
    expect(rowHasTallStructure([sq])).toBe(false);
  });

  it("stacked fraction IS tall", () => {
    const fr = mkFrac() as Extract<Node, { kind: "frac" }>;
    fr.rows[0] = chars("1");
    fr.rows[1] = chars("2");
    expect(rowHasTallStructure([fr])).toBe(true);
  });

  it("fraction nested inside brackets IS tall", () => {
    const fr = mkFrac() as Extract<Node, { kind: "frac" }>;
    fr.rows[0] = chars("a");
    fr.rows[1] = chars("b");
    const br = mkBracket("(", ")") as Extract<Node, { kind: "bracket" }>;
    br.rows[0] = [fr];
    expect(rowHasTallStructure([mkChar("y"), mkChar("="), br])).toBe(true);
  });

  it("fraction under a square root IS tall", () => {
    const fr = mkFrac() as Extract<Node, { kind: "frac" }>;
    const sq = mkSqrt() as Extract<Node, { kind: "sqrt" }>;
    sq.rows[0] = [fr];
    expect(rowHasTallStructure([sq])).toBe(true);
  });

  it("matrix and big operators ARE tall", () => {
    expect(rowHasTallStructure([mkMatrix(2, 2, "(", ")")])).toBe(true);
    expect(rowHasTallStructure([mkBigOp("sum")])).toBe(true);
  });

  it("empty row is NOT tall", () => {
    expect(rowHasTallStructure([])).toBe(false);
  });
});

// Regression: the sensor parks by ACTUAL board ink, never by stale
// ownership entries. "Last written row" = lowest row with VISIBLE ink;
// whitespace-only rows are invisible and must be skipped.
import { rowHasVisibleInk } from "@/lib/smartboard/rowAscii";

describe("rowHasVisibleInk — only real content counts as ink", () => {
  it("plain equation has visible ink", () => {
    expect(rowHasVisibleInk(chars("x+y=7(1)"))).toBe(true);
  });

  it("whitespace-only row is NOT ink", () => {
    expect(rowHasVisibleInk(chars("   "))).toBe(false);
  });

  it("empty row is NOT ink", () => {
    expect(rowHasVisibleInk([])).toBe(false);
  });

  it("structural nodes (fraction, root) ARE ink even with empty slots", () => {
    expect(rowHasVisibleInk([mkFrac()])).toBe(true);
    expect(rowHasVisibleInk([mkSqrt()])).toBe(true);
  });

  it("spaces followed by a character IS ink", () => {
    expect(rowHasVisibleInk(chars("  x"))).toBe(true);
  });
});

describe("sensor target = last visible ink row + 1 (zero gap)", () => {
  /** Mirrors lastVisibleInkRow + nextSensorRowBelow in PresentationView:
   *  scan the band for the lowest row with visible ink, then park one
   *  row below (plain rows add no extra space). */
  const computeTarget = (
    freeLines: Record<number, Row>,
    a: number,
    b: number,
  ): number => {
    let last = -1;
    for (const key of Object.keys(freeLines)) {
      const r = Math.floor(Number(key));
      if (r < a || r > b) continue;
      if (rowHasVisibleInk(freeLines[Number(key)])) last = Math.max(last, r);
    }
    if (last < a) return a;
    const extra = rowHasTallStructure(freeLines[last] ?? freeLines[last + 0.5] ?? []) ? 1 : 0;
    return Math.min(b, last + 1 + extra);
  };

  it("finished plain equation → sensor exactly one row below, never +2/+3", () => {
    const freeLines: Record<number, Row> = { 3: chars("x+y=7(1)") };
    expect(computeTarget(freeLines, 3, 12)).toBe(4);
  });

  it("stray whitespace rows below the equation are ignored", () => {
    const freeLines: Record<number, Row> = {
      3: chars("x+y=7(1)"),
      5: chars("  "), // leftover spaces — used to drag the sensor to row 6
      6: [],
    };
    expect(computeTarget(freeLines, 3, 12)).toBe(4);
  });

  it("half-row keys with whitespace do not push the target down", () => {
    const freeLines: Record<number, Row> = {
      3: chars("x-y=3(2)"),
      4.5: chars(" "),
    };
    expect(computeTarget(freeLines, 3, 12)).toBe(4);
  });

  it("empty band → sensor lands right below Solution", () => {
    expect(computeTarget({}, 3, 12)).toBe(3);
  });

  it("fraction row still reserves its extra row", () => {
    const fr = mkFrac() as Extract<Node, { kind: "frac" }>;
    fr.rows[0] = chars("1");
    fr.rows[1] = chars("2");
    const freeLines: Record<number, Row> = { 3: [mkChar("x"), mkChar("="), fr] };
    expect(computeTarget(freeLines, 3, 12)).toBe(5);
  });
});

// ═════════════════════════════════════════════════════════════════════
// LAW 1 — FORWARD-ONLY RULE: the presentation may only rewind when ink
// was ACTUALLY DELETED from the latest completed line's own rows.
// Typing anywhere else on the board can never trigger a rewind.
// Mirrors the erase effect in PresentationView.
// ═════════════════════════════════════════════════════════════════════
import { rowToAscii, equationsMatch, equationsEquivalent } from "@/lib/smartboard/rowAscii";

type FreeLineMap = Record<number, Row>;

/** Mirror of the erase effect's line-reader: integer + half-row keys. */
const readLine = (src: FreeLineMap, owned: number[]): string =>
  owned
    .map((r) => {
      const whole = src[r];
      const half = src[r + 0.5];
      return (
        (whole && whole.length > 0 ? rowToAscii(whole) : "") +
        (half && half.length > 0 ? rowToAscii(half) : "")
      );
    })
    .join("");

/** Mirror of the rewind decision: returns true when a rewind fires. */
const rewindFires = (
  before: FreeLineMap,
  now: FreeLineMap,
  owned: number[],
  equation: string,
): boolean => {
  if (owned.length === 0) return false;
  const nowText = readLine(now, owned);
  const beforeText = readLine(before, owned);
  if (nowText.length >= beforeText.length) return false; // LAW 1
  const ok =
    nowText.length > 0 &&
    (equationsEquivalent(nowText, equation) || equationsMatch(nowText, equation));
  return !ok;
};

describe("LAW 1 — Forward-Only Rule (never rewind while typing forward)", () => {
  it("typing on a fresh row NEVER rewinds — line's own ink unchanged", () => {
    const before: FreeLineMap = { 5: chars("2x=6") };
    const now: FreeLineMap = { 5: chars("2x=6"), 6: chars("x") }; // typing line 7
    expect(rewindFires(before, now, [5], "2x=6")).toBe(false);
  });

  it("fraction ink split across r and r+0.5 reads complete — no false rewind", () => {
    const before: FreeLineMap = { 5: chars("x="), 5.5: chars("3/2") };
    const now: FreeLineMap = { 5: chars("x="), 5.5: chars("3/2"), 7: chars("y") };
    // Old bug: reading only freeLines[5] gave "x=" → mismatch → rewind.
    expect(rewindFires(before, now, [5], "x=3/2")).toBe(false);
  });

  it("owned row that is legitimately blank (structure spillover) never rewinds", () => {
    const before: FreeLineMap = { 5: chars("x=3"), 6: [] };
    const now: FreeLineMap = { 5: chars("x=3"), 6: [], 7: chars("+") };
    expect(rewindFires(before, now, [5, 6], "x=3")).toBe(false);
  });

  it("REAL deletion from the line's own rows still rewinds", () => {
    const before: FreeLineMap = { 5: chars("2x=6") };
    const now: FreeLineMap = { 5: chars("2x") }; // teacher erased "=6"
    expect(rewindFires(before, now, [5], "2x=6")).toBe(true);
  });

  it("deletion that still leaves a matching equation does NOT rewind", () => {
    const before: FreeLineMap = { 5: chars("2x=6 ") };
    const now: FreeLineMap = { 5: chars("2x=6") }; // trimmed a space
    expect(rewindFires(before, now, [5], "2x=6")).toBe(false);
  });

  it("line never written this session (no owned rows) never rewinds", () => {
    const before: FreeLineMap = {};
    const now: FreeLineMap = { 8: chars("x") };
    expect(rewindFires(before, now, [], "2x=6")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// LAW 2 — LOCKED-INK RULE: a write targeting a row that already carries
// visible ink is relocated below — existing ink always survives.
// Mirrors writeProseLineOnBoard's relocation loop.
// ═════════════════════════════════════════════════════════════════════
describe("LAW 2 — Locked-Ink Rule (writes never destroy existing ink)", () => {
  const relocate = (
    prev: FreeLineMap,
    sensorRow: number,
    noteRows: Set<number> = new Set(),
  ): number => {
    let target = Math.floor(sensorRow);
    const occupied = (r: number): boolean => {
      const whole = prev[r];
      const half = prev[r + 0.5];
      return (
        (!!whole && rowHasVisibleInk(whole)) ||
        (!!half && rowHasVisibleInk(half)) ||
        noteRows.has(r)
      );
    };
    while (occupied(target)) target++;
    return target;
  };

  it("write on the denominator row of a completed fraction slides below it", () => {
    // Line 5 = fraction: numerator on row 5, denominator ink on 5.5;
    // sensor mistakenly still parked on row 5.
    const prev: FreeLineMap = { 5: chars("x="), 5.5: chars("3/2") };
    expect(relocate(prev, 5)).toBe(6);
  });

  it("write on an empty row stays exactly where the teacher put it", () => {
    const prev: FreeLineMap = { 4: chars("x+y=7") };
    expect(relocate(prev, 6)).toBe(6);
  });

  it("consecutive occupied rows are all skipped — first free row wins", () => {
    const prev: FreeLineMap = { 5: chars("a"), 6: chars("b"), 7: chars("c") };
    expect(relocate(prev, 5)).toBe(8);
  });

  it("note rows are occupied too", () => {
    const prev: FreeLineMap = { 5: chars("x=1") };
    expect(relocate(prev, 5, new Set([6]))).toBe(7);
  });

  it("original ink is untouched by relocation (pure lookup)", () => {
    const prev: FreeLineMap = { 5: chars("x=") };
    const asciiBefore = rowToAscii(prev[5]);
    relocate(prev, 5);
    expect(rowToAscii(prev[5])).toBe(asciiBefore);
  });
});

describe("sensor advance clears the WHOLE previous structure", () => {
  /** Mirror of the line-sync advance: target starts below last ink, then
   *  is pushed past every row owned by earlier lines (+ tall padding). */
  const advanceTarget = (
    freeLines: FreeLineMap,
    rowOwners: Record<number, number>,
    idx: number,
    a: number,
    b: number,
  ): number => {
    let last = -1;
    for (const key of Object.keys(freeLines)) {
      const r = Math.floor(Number(key));
      if (r < a || r > b) continue;
      if (rowHasVisibleInk(freeLines[Number(key)])) last = Math.max(last, r);
    }
    if (last < a) return a;
    const extraFor = (r: number): number => {
      const row = freeLines[r] ?? freeLines[r + 0.5];
      return row && rowHasTallStructure(row) ? 1 : 0;
    };
    let t = last + 1 + extraFor(last);
    for (const [rk, o] of Object.entries(rowOwners)) {
      const rr = Math.floor(Number(rk));
      if (!Number.isFinite(rr) || rr < a || rr > b || o >= idx) continue;
      const row = freeLines[rr] ?? freeLines[rr + 0.5];
      if (!row || !rowHasVisibleInk(row)) continue;
      t = Math.max(t, rr + 1 + extraFor(rr));
    }
    return Math.min(b, t);
  };

  it("after a two-row fraction line the sensor lands BELOW the denominator", () => {
    const fr = mkFrac() as Extract<Node, { kind: "frac" }>;
    fr.rows[0] = chars("1");
    fr.rows[1] = chars("2");
    const freeLines: FreeLineMap = { 5: [mkChar("x"), mkChar("="), fr] };
    // Fraction on row 5 visually covers row 6 → sensor must go to 7.
    expect(advanceTarget(freeLines, { 5: 4 }, 5, 3, 12)).toBe(7);
  });

  it("plain equation still yields zero gap (row + 1)", () => {
    const freeLines: FreeLineMap = { 5: chars("x+y=7") };
    expect(advanceTarget(freeLines, { 5: 4 }, 5, 3, 12)).toBe(6);
  });
});
