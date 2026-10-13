import { describe, expect, it } from "vitest";
import { parseEquation } from "../math";
import { ncube } from "../ncube";
import { LIBRARY } from "../library";

describe("Graph app maths", () => {
  it("y = x² gives 4 at x = 2", () => {
    const p = parseEquation("y = x²");
    expect(p.kind).toBe("curve2d");
    if (p.kind === "curve2d") expect(p.f({ x: 2 })).toBe(4);
  });
  it("z = x² + y² gives 5 at (2, 1)", () => {
    const p = parseEquation("z = x^2 + y^2");
    if (p.kind !== "surface") throw new Error(p.kind);
    expect(p.f({ x: 2, y: 1 })).toBe(5);
  });
  it("sphere of radius 3 is zero on its surface", () => {
    const p = parseEquation("x^2 + y^2 + z^2 = 9");
    if (p.kind !== "implicit3d") throw new Error(p.kind);
    expect(p.f({ x: 3, y: 0, z: 0 })).toBe(0);
  });
  it("reads |x|, √, π and 2x the same way", () => {
    const p = parseEquation("y = |x| + √(4) + 2x - π");
    if (p.kind !== "curve2d") throw new Error(p.kind);
    expect(p.f({ x: -1 })).toBeCloseTo(1 + 2 - 2 - Math.PI);
  });
  it("reports an error for two equals signs", () => {
    expect(parseEquation("y = x = 2").kind).toBe("error");
  });
  it("tesseract has 16 vertices and 32 edges", () => {
    const c = ncube(4);
    expect(c.verts.length).toBe(16);
    expect(c.edges.length).toBe(32);
  });
  it("every library entry can be read", () => {
    for (const e of LIBRARY) if (!e.expr.startsWith("ncube")) expect(parseEquation(e.expr).kind).not.toBe("error");
  });
});
