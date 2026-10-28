// Composition tests — nested structures must stay independently editable
// and the caret must be able to reach every slot AND the space outside.
//
// The mandatory workflow is √(y/6) + 8/8: a fraction inside a radical,
// followed by a second, separate fraction on the same line.

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
  moveLeft,
  moveRight,
  insertNode,
  insertChar,
  getRowAt,
  exitContainerRight,
} from "../mathTree";

const chars = (row: Row) => row.map((n) => (n.kind === "char" ? n.ch : n.kind));

describe("recursive vertical navigation", () => {
  it("steps out of a fraction nested two containers deep", () => {
    // matrix cell → sqrt → frac
    const m = mkMatrix(2, 2) as Extract<ReturnType<typeof mkMatrix>, { kind: "matrix" }>;
    const s = mkSqrt() as Extract<ReturnType<typeof mkSqrt>, { kind: "sqrt" }>;
    const f = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
    const frac = { ...f, rows: [[mkChar("y")], [mkChar("6")]] };
    const sqrt = { ...s, rows: [[frac]] };
    const root: Row = [{ ...m, rows: [[sqrt], [], [], []] }];

    // Caret in the fraction's denominator, inside the radical, inside cell 0.
    const inDen: Cursor = { path: [0, 0, 0, 0, 0, 1], index: 1 };
    // ▼ has no lower slot in the fraction, none in the radical — but the
    // matrix cell below exists, so the search must continue OUTWARD.
    const down = moveDown(root, inDen);
    expect(down?.path).toEqual([0, 2]);
    // ▲ from the numerator escapes the fraction, then the radical, then cell.
    const inNum: Cursor = { path: [0, 0, 0, 0, 0, 0], index: 1 };
    const up1 = moveUp(root, inNum)!;
    expect(up1).toEqual({ path: [0, 0, 0, 0], index: 1 });
    const up2 = moveUp(root, up1)!;
    expect(up2).toEqual({ path: [0, 0], index: 1 });
  });

  it("returns null only when no enclosing structure has a slot below", () => {
    const f = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
    const root: Row = [{ ...f, rows: [[mkChar("y")], [mkChar("6")]] }];
    expect(moveDown(root, { path: [0, 1], index: 1 })).toBeNull();
  });

  it("keeps a power inside a fraction independently editable", () => {
    const f = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
    const p = mkPower() as Extract<ReturnType<typeof mkPower>, { kind: "power" }>;
    const power = { ...p, rows: [[mkChar("x")], [mkChar("2")]] };
    const root: Row = [{ ...f, rows: [[power], [mkChar("6")]] }];
    // base → exponent stays inside the power (no leak to the denominator).
    expect(moveUp(root, { path: [0, 0, 0, 0], index: 1 })!.path).toEqual([0, 0, 0, 1]);
    // From the exponent, ▼ returns to the base, not to the denominator.
    expect(moveDown(root, { path: [0, 0, 0, 1], index: 1 })!.path).toEqual([0, 0, 0, 0]);
  });
});

describe("the mandatory √(y/6) + 8/8 workflow", () => {
  it("builds the expression with the radical holding only y/6", () => {
    let root: Row = [];
    let cursor: Cursor = { path: [], index: 0 };

    ({ root, cursor } = insertNode(root, cursor, mkSqrt()));
    ({ root, cursor } = insertNode(root, cursor, mkFrac()));
    ({ root, cursor } = insertChar(root, cursor, "y"));
    cursor = moveDown(root, cursor)!;              // numerator → denominator
    ({ root, cursor } = insertChar(root, cursor, "6"));

    cursor = moveUp(root, cursor)!;                // → numerator
    cursor = moveUp(root, cursor)!;                // out of the fraction
    cursor = exitContainerRight(root, cursor);     // out of the radical
    expect(cursor).toEqual({ path: [], index: 1 });

    ({ root, cursor } = insertChar(root, cursor, "+"));
    ({ root, cursor } = insertNode(root, cursor, mkFrac()));
    ({ root, cursor } = insertChar(root, cursor, "8"));
    cursor = moveDown(root, cursor)!;
    ({ root, cursor } = insertChar(root, cursor, "8"));

    expect(chars(root)).toEqual(["sqrt", "+", "frac"]);
    expect(getRowAt(root, [0, 0])).toHaveLength(1);
    expect(chars(getRowAt(root, [0, 0, 0, 0]))).toEqual(["y"]);
    expect(chars(getRowAt(root, [0, 0, 0, 1]))).toEqual(["6"]);
    expect(chars(getRowAt(root, [2, 0]))).toEqual(["8"]);
    expect(chars(getRowAt(root, [2, 1]))).toEqual(["8"]);
  });

  it("walks the whole finished expression with ◀ / ▶ without getting stuck", () => {
    // Rebuild the same expression, then walk right from the very start and
    // confirm the caret both enters every slot and comes back out to the row.
    const f1 = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
    const s = mkSqrt() as Extract<ReturnType<typeof mkSqrt>, { kind: "sqrt" }>;
    const inner = { ...f1, rows: [[mkChar("y")], [mkChar("6")]] };
    const root: Row = [
      { ...s, rows: [[inner]] },
      mkChar("+"),
      { ...(mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>), rows: [[mkChar("8")], [mkChar("8")]] },
    ];

    let c: Cursor = { path: [], index: 0 };
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      c = moveRight(root, c);
      seen.push(c.path.join("."));
    }
    // Reached the outside-of-radical position and the second fraction.
    expect(seen).toContain("");            // back out on the root row
    expect(seen.some((p) => p.startsWith("2.0"))).toBe(true);
    expect(seen.some((p) => p.startsWith("2.1"))).toBe(true);
    // And ◀ can travel back all the way to the start.
    for (let i = 0; i < 40; i++) c = moveLeft(root, c);
    expect(c).toEqual({ path: [], index: 0 });
  });
});

describe("matrix cells accept nested structures", () => {
  it("puts a fraction inside a single cell and keeps neighbours empty", () => {
    const m = mkMatrix(2, 2) as Extract<ReturnType<typeof mkMatrix>, { kind: "matrix" }>;
    let root: Row = [m];
    let cursor: Cursor = { path: [0, 0], index: 0 };
    ({ root, cursor } = insertNode(root, cursor, mkFrac()));
    ({ root, cursor } = insertChar(root, cursor, "1"));
    cursor = moveDown(root, cursor)!;
    ({ root, cursor } = insertChar(root, cursor, "2"));

    expect(chars(getRowAt(root, [0, 0]))).toEqual(["frac"]);
    expect(chars(getRowAt(root, [0, 0, 0, 0]))).toEqual(["1"]);
    expect(chars(getRowAt(root, [0, 0, 0, 1]))).toEqual(["2"]);
    expect(getRowAt(root, [0, 1])).toHaveLength(0);
    expect(getRowAt(root, [0, 2])).toHaveLength(0);
    expect(getRowAt(root, [0, 3])).toHaveLength(0);
  });
});
