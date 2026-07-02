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
