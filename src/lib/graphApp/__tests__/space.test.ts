import { describe, it, expect } from "vitest";
import { parseEquation } from "../math";
import { crossSection, intersectPlanes, planeOf, planeText, solveThree, type Plane } from "../space";

const plane = (s: string) => { const p = planeOf(parseEquation(s)); if (!p) throw Error(`not a plane: ${s}`); return p; };

describe("Math Lab 3D (Stage 5)", () => {
  it("recognises 2x + y − z = 4 as a plane", () => { const p = plane("2x + y - z = 4"); expect(p.n).toEqual([2, 1, -1]); expect(p.d).toBe(4); expect(planeText(p)).toBe("2x + y − z = 4"); });
  it("does not treat a sphere as a plane", () => expect(planeOf(parseEquation("x^2 + y^2 + z^2 = 9"))).toBeNull());
  it("two planes meet in a line lying on both", () => {
    const p = plane("x + y + z = 6"), q = plane("x - y = 0");
    const m = intersectPlanes(p, q); if (m.kind !== "line") throw Error(m.kind);
    for (const t of [0, 2.5]) { const r = m.point.map((v, i) => v + t * m.dir[i]); expect(r[0] + r[1] + r[2]).toBeCloseTo(6); expect(r[0] - r[1]).toBeCloseTo(0); }
  });
  it("detects parallel and identical planes", () => {
    expect(intersectPlanes(plane("x + y + z = 1"), plane("2x + 2y + 2z = 5")).kind).toBe("parallel");
    expect(intersectPlanes(plane("x + y + z = 1"), plane("2x + 2y + 2z = 2")).kind).toBe("same");
  });
  it("solves three planes at one point", () => {
    const r = solveThree([plane("x + y + z = 6"), plane("2x - y + z = 3"), plane("x + 2y - z = 2")]);
    if (r.kind !== "point") throw Error(r.kind);
    expect(r.point.map((v) => Math.round(v * 1e9) / 1e9)).toEqual([1, 2, 3]);
  });
  it("classifies no solution and infinitely many", () => {
    const a: Plane = plane("x + y + z = 1"), b = plane("x + y + z = 2"), c = plane("x - y = 0");
    expect(solveThree([a, b, c]).kind).toBe("none");
    expect(solveThree([plane("x + y + z = 3"), plane("x - y = 0"), plane("2x + z = 3")]).kind).toBe("infinite");
  });
  it("slices z = x² + y² at height 4 into a circle of radius 2", () => {
    const eq = parseEquation("z = x^2 + y^2"); if (eq.kind !== "surface") throw Error();
    const segs = crossSection(eq.f, 4);
    expect(segs.length).toBeGreaterThan(20);
    for (const [p] of segs) { expect(Math.hypot(p[0], p[1])).toBeCloseTo(2, 1); expect(p[2]).toBe(4); }
  });
});
