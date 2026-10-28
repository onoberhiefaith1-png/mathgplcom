// Vertical (slot ↔ slot) caret navigation.
//
// The teacher must be able to walk the writing sensor freely across a
// numerator, a denominator, a radicand and the space OUTSIDE the structure —
// otherwise an expression like √(y/6) + 8/8 cannot be written at all (the
// caret stays trapped in the denominator and every character keeps expanding
// the radical).

import { describe, it, expect } from "vitest";
import {
  type Row,
  type Cursor,
  mkChar,
  mkFrac,
  mkSqrt,
  mkPower,
  mkMatrix,
  moveUp,
  moveDown,
  moveRight,
  insertNode,
  insertChar,
  getRowAt,
  exitContainerRight,
} from "../mathTree";

const frac = (num: string, den: string): Row => {
  const n = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
  return [{ ...n, rows: [[...num].map(mkChar), [...den].map(mkChar)] }];
};

describe("vertical caret navigation", () => {
  it("steps denominator → numerator and back", () => {
    const root = frac("y", "6");
    const inDen: Cursor = { path: [0, 1], index: 1 };
    const up = moveUp(root, inDen)!;
    expect(up.path).toEqual([0, 0]);
    const down = moveDown(root, up)!;
    expect(down.path).toEqual([0, 1]);
  });

  it("escapes the structure when there is nothing above", () => {
    const root = frac("y", "6");
    const inNum: Cursor = { path: [0, 0], index: 1 };
    const out = moveUp(root, inNum)!;
    expect(out).toEqual({ path: [], index: 1 });
  });

  it("escapes a radical (single-slot container) upward", () => {
    const sqrtNode = mkSqrt() as Extract<ReturnType<typeof mkSqrt>, { kind: "sqrt" }>;
    const root: Row = [{ ...sqrtNode, rows: [frac("y", "6")] }];
    // Caret inside the radical's fraction denominator.
    const inDen: Cursor = { path: [0, 0, 0, 1], index: 1 };
    const toNum = moveUp(root, inDen)!;
    expect(toNum.path).toEqual([0, 0, 0, 0]);
    const outOfFrac = moveUp(root, toNum)!;
    expect(outOfFrac).toEqual({ path: [0, 0], index: 1 });
    const outOfSqrt = moveUp(root, outOfFrac)!;
    expect(outOfSqrt).toEqual({ path: [], index: 1 });
  });

  it("returns null at top level and below the last slot", () => {
    const root = frac("y", "6");
    expect(moveUp(root, { path: [], index: 0 })).toBeNull();
    expect(moveDown(root, { path: [0, 1], index: 0 })).toBeNull();
  });

  it("steps base ↔ exponent on a power", () => {
    const p = mkPower() as Extract<ReturnType<typeof mkPower>, { kind: "power" }>;
    const root: Row = [{ ...p, rows: [[mkChar("x")], [mkChar("2")]] }];
    expect(moveUp(root, { path: [0, 0], index: 1 })!.path).toEqual([0, 1]);
    expect(moveDown(root, { path: [0, 1], index: 1 })!.path).toEqual([0, 0]);
  });

  it("walks a matrix column-wise", () => {
    const m = mkMatrix(2, 2) as Extract<ReturnType<typeof mkMatrix>, { kind: "matrix" }>;
    const root: Row = [m];
    // cell index 2 (row 1, col 0) → up → cell 0
    expect(moveUp(root, { path: [0, 2], index: 0 })!.path).toEqual([0, 0]);
    expect(moveDown(root, { path: [0, 1], index: 0 })!.path).toEqual([0, 3]);
    // Top row has no cell above → escape the matrix.
    expect(moveUp(root, { path: [0, 0], index: 0 })).toEqual({ path: [], index: 1 });
  });

  it("builds √(y/6) + 8/8 purely through cursor moves", () => {
    let root: Row = [];
    let cursor: Cursor = { path: [], index: 0 };

    // √ …
    ({ root, cursor } = insertNode(root, cursor, mkSqrt()));
    // … y/6 inside the radicand
    ({ root, cursor } = insertNode(root, cursor, mkFrac()));
    ({ root, cursor } = insertChar(root, cursor, "y"));      // numerator
    const down = moveDown(root, cursor)!;
    cursor = down;
    ({ root, cursor } = insertChar(root, cursor, "6"));      // denominator

    // Leave the fraction, then leave the radical.
    cursor = moveUp(root, moveUp(root, cursor)!)!;           // out of frac
    expect(cursor).toEqual({ path: [0, 0], index: 1 });
    cursor = exitContainerRight(root, cursor);               // out of sqrt
    expect(cursor).toEqual({ path: [], index: 1 });

    // + 8/8 beside the radical.
    ({ root, cursor } = insertChar(root, cursor, "+"));
    ({ root, cursor } = insertNode(root, cursor, mkFrac()));
    ({ root, cursor } = insertChar(root, cursor, "8"));
    cursor = moveDown(root, cursor)!;
    ({ root, cursor } = insertChar(root, cursor, "8"));

    // Top level: sqrt, "+", frac — the 8/8 is OUTSIDE the radical.
    expect(root.map((n) => (n.kind === "char" ? n.ch : n.kind))).toEqual([
      "sqrt", "+", "frac",
    ]);
    // The radicand holds exactly the fraction y/6.
    const radicand = getRowAt(root, [0, 0]);
    expect(radicand).toHaveLength(1);
    expect(radicand[0].kind).toBe("frac");
    expect(getRowAt(root, [0, 0, 0, 0]).map((n) => (n as { ch: string }).ch)).toEqual(["y"]);
    expect(getRowAt(root, [0, 0, 0, 1]).map((n) => (n as { ch: string }).ch)).toEqual(["6"]);
    // The outside fraction holds 8 over 8.
    expect(getRowAt(root, [2, 0]).map((n) => (n as { ch: string }).ch)).toEqual(["8"]);
    expect(getRowAt(root, [2, 1]).map((n) => (n as { ch: string }).ch)).toEqual(["8"]);
  });

  it("moveRight also exits the deepest slot eventually", () => {
    const sqrtNode = mkSqrt() as Extract<ReturnType<typeof mkSqrt>, { kind: "sqrt" }>;
    const root: Row = [{ ...sqrtNode, rows: [[mkChar("y")]] }];
    const atEnd: Cursor = { path: [0, 0], index: 1 };
    expect(moveRight(root, atEnd)).toEqual({ path: [], index: 1 });
  });
});
