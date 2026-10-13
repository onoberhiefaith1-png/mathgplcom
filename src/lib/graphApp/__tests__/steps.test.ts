import { describe, expect, it } from "vitest";
import { asLinearSystem, asVertexForm, linearCoeffs, quadraticSteps, systemSteps, equationFn } from "../steps";
import { parseEquation } from "../math";

describe("linearCoeffs", () => {
  it("reads 2x = y + 3 as 2x − y = 3", () => {
    const f = equationFn("2x = y + 3")!;
    expect(linearCoeffs(f)).toEqual({ a: 2, b: -1, c: 3 });
  });
  it("rejects a non-linear equation", () => {
    expect(linearCoeffs(equationFn("x^2 + y^2 = 4")!)).toBeNull();
  });
});

describe("systemSteps", () => {
  it("solves 2x = y + 3; x + y = 6 → (3, 3)", () => {
    const s = asLinearSystem(equationFn("2x = y + 3")!, equationFn("x + y = 6")!)!;
    expect(s.kind).toBe("point");
    expect(s.x).toBeCloseTo(3);
    expect(s.y).toBeCloseTo(3);
    expect(s.steps.join(" ")).toContain("(3, 3)");
  });
  it("solves a changed-numbers variant → nothing hard-coded", () => {
    // x + y = 10; x − y = 4 → (7, 3)
    const s = asLinearSystem(equationFn("x + y = 10")!, equationFn("x - y = 4")!)!;
    expect(s.kind).toBe("point");
    expect(s.x).toBeCloseTo(7);
    expect(s.y).toBeCloseTo(3);
  });
  it("detects parallel lines", () => {
    const s = systemSteps({ a: 1, b: 1, c: 2 }, { a: 2, b: 2, c: 6 });
    expect(s.kind).toBe("parallel");
    expect(s.steps.join(" ")).toContain("no solution");
  });
  it("detects coincident lines", () => {
    const s = systemSteps({ a: 1, b: 1, c: 2 }, { a: 2, b: 2, c: 4 });
    expect(s.kind).toBe("coincident");
    expect(s.steps.join(" ")).toContain("infinitely many");
  });
});

describe("quadraticSteps", () => {
  it("vertex form y = (x − 2)² − 1: vertex (2, −1), roots 1 and 3", () => {
    const q = quadraticSteps(1, 2, -1);
    expect(q.steps.join(" ")).toContain("(2, −1)");
    expect(q.steps.join(" ")).toContain("x = 1 or x = 3");
  });
  it("reports no real roots when the discriminant is negative", () => {
    const q = quadraticSteps(1, 0, 4);
    expect(q.steps.join(" ")).toContain("no real roots");
  });
  it("reports a repeated root on the axis", () => {
    const q = quadraticSteps(2, 3, 0);
    expect(q.steps.join(" ")).toContain("repeated root");
  });
});

describe("asVertexForm", () => {
  it("recovers a, h, k from a plotted vertex-form curve", () => {
    const eq = parseEquation("y = 2 * (x - 1)^2 + 3");
    if (eq.kind !== "curve2d") throw new Error("expected curve");
    const v = asVertexForm(eq.f)!;
    expect(v.a).toBeCloseTo(2);
    expect(v.h).toBeCloseTo(1);
    expect(v.k).toBeCloseTo(3);
  });
  it("rejects a non-quadratic curve", () => {
    const eq = parseEquation("y = sin(x)");
    if (eq.kind !== "curve2d") throw new Error("expected curve");
    expect(asVertexForm(eq.f)).toBeNull();
  });
});
