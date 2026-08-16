// Tree navigation tests for the `###` / `####` commands.
//
// `#` wraps the term on the left and opens its superscript, `##` switches to
// the subscript. This file covers the two navigation commands built on top:
// `navigateOut(root, cursor, -1)` (backward/up) and `+1` (forward/down).

import { describe, it, expect } from "vitest";
import {
  type Row,
  type Cursor,
  mkChar,
  mkSubSup,
  mkFrac,
  navigateOut,
  getRowAt,
  cursorsEqual,
} from "../mathTree";

/** subsup node = [base, sub, sup]. */
const subsup = (base: string, sub: string[], sup: string[]): Row => {
  const n = mkSubSup() as Extract<ReturnType<typeof mkSubSup>, { kind: "subsup" }>;
  return [{
    ...n,
    rows: [
      [...base].map(mkChar),
      sub.map(mkChar),
      sup.map(mkChar),
    ],
  }];
};

/** 1 # 2 # 3 # 4 — a genuine chain of superscripts, four levels deep. */
const nestedPower = (): Row => {
  let inner: Row = subsup("4", [], []);
  for (const ch of ["3", "2"]) {
    const n = mkSubSup() as Extract<ReturnType<typeof mkSubSup>, { kind: "subsup" }>;
    inner = [{ ...n, rows: [[mkChar(ch)], [], inner] }];
  }
  const n = mkSubSup() as Extract<ReturnType<typeof mkSubSup>, { kind: "subsup" }>;
  return [{ ...n, rows: [[mkChar("1")], [], inner] }];
};

/** Caret just after the `4` at the bottom of the chain (three levels deep). */
const deepest: Cursor = { path: [0, 2, 0, 2, 0, 0], index: 1 };

describe("navigateOut — backward / up (###)", () => {
  it("steps out of the deepest branch to the level above", () => {
    const root = nestedPower();
    const out = navigateOut(root, deepest, -1);
    // Left the base of the innermost script, landing in the row that holds it.
    expect(out.path).toEqual([0, 2, 0, 2]);
    expect(getRowAt(root, out.path).map((n) => (n.kind === "char" ? n.ch : n.kind)))
      .toEqual(["subsup"]);
  });

  it("walks all the way out to the outermost row, then stops", () => {
    const root = nestedPower();
    let c = deepest;
    const depths: number[] = [];
    for (let i = 0; i < 10; i++) {
      c = navigateOut(root, c, -1);
      depths.push(c.path.length);
    }
    // Depth never grows, every cursor is structurally valid, and once the
    // caret reaches the outermost row it simply stays there.
    expect(depths.every((d) => d % 2 === 0)).toBe(true);
    depths.forEach((d, i) => { if (i) expect(d).toBeLessThanOrEqual(depths[i - 1]); });
    expect(depths[depths.length - 1]).toBe(0);
    expect(cursorsEqual(navigateOut(root, c, -1), c)).toBe(true);
  });

  it("prefers an earlier sibling branch that actually holds ink", () => {
    const root = subsup("x", ["n"], ["2"]);       // base, sub = n, sup = 2
    const inSup: Cursor = { path: [0, 2], index: 1 };
    const out = navigateOut(root, inSup, -1);
    expect(out).toEqual({ path: [0, 1], index: 1 }); // end of the subscript
  });

  it("skips an empty sibling branch instead of entering it", () => {
    const root = subsup("x", [], ["2"]);          // no subscript at all
    const inSup: Cursor = { path: [0, 2], index: 1 };
    // The empty subscript is passed over; the base still holds ink, so the
    // caret lands there rather than in a slot that does not exist.
    expect(navigateOut(root, inSup, -1)).toEqual({ path: [0, 0], index: 1 });
  });


  it("never moves and never creates a node when nothing valid exists", () => {
    const root: Row = [mkChar("1")];
    const at: Cursor = { path: [], index: 0 };
    const before = JSON.stringify(root);
    expect(cursorsEqual(navigateOut(root, at, -1), at)).toBe(true);
    expect(JSON.stringify(root)).toBe(before);
  });
});

describe("navigateOut — forward / down (####)", () => {
  it("is the mirror image: sub → sup", () => {
    const root = subsup("x", ["n"], ["2"]);
    const inSub: Cursor = { path: [0, 1], index: 1 };
    expect(navigateOut(root, inSub, 1)).toEqual({ path: [0, 2], index: 0 });
  });

  it("steps out past the container when no later branch has ink", () => {
    const root = subsup("x", [], []);
    const inBase: Cursor = { path: [0, 0], index: 1 };
    expect(navigateOut(root, inBase, 1)).toEqual({ path: [], index: 1 });
  });

  it("round-trips with ### on a single script", () => {
    const root = subsup("x", ["n"], ["2"]);
    const inSup: Cursor = { path: [0, 2], index: 1 };
    const up = navigateOut(root, inSup, -1);          // → subscript
    const back = navigateOut(root, up, 1);            // → superscript again
    expect(back.path).toEqual([0, 2]);
  });


  it("descends into the next independent structure on the row", () => {
    // Two structures side by side, the second starting mid-expression.
    const root: Row = [
      ...subsup("1", [], ["2"]),
      mkChar("+"),
      ...subsup("4", [], ["5"]),
    ];
    const atStart: Cursor = { path: [], index: 1 };
    const out = navigateOut(root, atStart, 1);
    expect(out.path).toEqual([2, 0]); // into the base of the second structure
  });

  it("finds the previous structure when walking backward on the root row", () => {
    const root: Row = [
      ...subsup("1", [], ["2"]),
      mkChar("+"),
      ...subsup("4", [], ["5"]),
    ];
    const atEnd: Cursor = { path: [], index: 3 };
    expect(navigateOut(root, atEnd, -1)).toEqual({ path: [], index: 2 });
  });
});

describe("navigateOut — other container kinds", () => {
  it("works inside a fraction (numerator ↔ denominator)", () => {
    const f = mkFrac() as Extract<ReturnType<typeof mkFrac>, { kind: "frac" }>;
    const root: Row = [{ ...f, rows: [[mkChar("a")], [mkChar("b")]] }];
    const inNum: Cursor = { path: [0, 0], index: 1 };
    expect(navigateOut(root, inNum, 1)).toEqual({ path: [0, 1], index: 0 });
    const inDen: Cursor = { path: [0, 1], index: 1 };
    expect(navigateOut(root, inDen, -1)).toEqual({ path: [0, 0], index: 1 });
  });
});
