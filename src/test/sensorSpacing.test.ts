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
