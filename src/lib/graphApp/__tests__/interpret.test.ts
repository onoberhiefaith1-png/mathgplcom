import { describe, expect, it } from "vitest";
import { interpret, curveFeatures, parseMatrix } from "../interpret";
import { parseEquation } from "../math";

const fOf = (s: string) => { const p = parseEquation(s); if (p.kind !== "curve2d") throw Error(p.kind); return p.f; };

describe("Math Lab interpreter", () => {
  it("routes an equation to the plotter", () => expect(interpret("y = x^2 - 4").kind).toBe("plot"));
  it("recognises a system of equations", () => {
    const r = interpret("2x = y + 3; x + y = 6");
    expect(r).toEqual({ kind: "system", srcs: ["2x = y + 3", "x + y = 6"] });
  });
  it("reads a MATLAB-style matrix", () => expect(parseMatrix("[1 2; 3 4]")).toEqual([[1, 2], [3, 4]]));
  it("routes dy/dx to the ODE tool", () => expect(interpret("dy/dx = -0.5y").kind).toBe("ode"));
  it("opens a tool from a topic word", () => expect(interpret("determinant")).toMatchObject({ kind: "tool", tool: "matrices" }));
  it("recognises 4D geometry", () => expect(interpret("4D")).toEqual({ kind: "hypercube", n: 4 }));
  it("explains unknown input honestly", () => expect(interpret("banana").kind).toBe("error"));
});

describe("Computed curve features", () => {
  it("y = x² − 4: roots ±2, minimum (0, −4), axis x = 0", () => {
    const c = curveFeatures(fOf("y = x^2 - 4"));
    expect(c.roots).toEqual([-2, 2]);
    expect(c.turning).toEqual([{ x: 0, y: -4, type: "minimum" }]);
    expect(c.axisOfSymmetry).toBe(0);
    expect(c.yIntercept).toBe(-4);
    expect(c.table.find(r => r.x === -3)?.y).toBe(5);
  });
  it("changed numbers: y = x² + 3x − 4 has roots −4 and 1, vertex at x = −1.5", () => {
    const c = curveFeatures(fOf("y = x^2 + 3x - 4"));
    expect(c.roots).toEqual([-4, 1]);
    expect(c.turning[0].x).toBeCloseTo(-1.5, 5);
    expect(c.turning[0].y).toBeCloseTo(-6.25, 5);
  });
  it("cubic y = x³ − 3x has a maximum then a minimum", () => {
    const c = curveFeatures(fOf("y = x^3 - 3x"));
    expect(c.turning.map(t => t.type)).toEqual(["maximum", "minimum"]);
    expect(c.axisOfSymmetry).toBeNull();
  });
});
