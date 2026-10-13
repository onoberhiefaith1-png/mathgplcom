import { describe, expect, it } from "vitest";
import { mul, rootsOfUnity, parseC, complexFn } from "../complex";
import { normalBetween, binomialPmf, poissonPmf } from "../probability";
import { regression, summary, parsePoints } from "../stats";
import { newton, bisection } from "../numerical";
import { applyTransform, conic, dist } from "../geometry";

describe("Stage 11", () => {
  it("i·i = −1", () => { expect(mul({ re: 0, im: 1 }, { re: 0, im: 1 })).toEqual({ re: -1, im: 0 }); });
  it("cube roots of unity each cube to 1 and sum to 0", () => {
    const r = rootsOfUnity(3);
    for (const z of r) { const c = mul(mul(z, z), z); expect(c.re).toBeCloseTo(1); expect(c.im).toBeCloseTo(0); }
    expect(r.reduce((s, z) => s + z.re, 0)).toBeCloseTo(0);
  });
  it("reads 3 + 2i and evaluates z^2", () => {
    expect(parseC("3 + 2i")).toEqual({ re: 3, im: 2 });
    const w = complexFn("z^2")({ re: 1, im: 1 });
    expect(w.re).toBeCloseTo(0); expect(w.im).toBeCloseTo(2);
  });
  it("P(−1 < Z < 1) ≈ 0.6827", () => { expect(normalBetween(-1, 1, 0, 1)).toBeCloseTo(0.682689, 5); });
  it("binomial and Poisson known values", () => {
    expect(binomialPmf(4, 0.5, 2)).toBeCloseTo(0.375);
    expect(poissonPmf(2, 0)).toBeCloseTo(Math.exp(-2));
  });
  it("regression through (1,2),(2,4),(3,6) is y = 2x", () => {
    const r = regression(parsePoints("1,2\n2,4\n3,6"));
    expect(r.slope).toBeCloseTo(2); expect(r.intercept).toBeCloseTo(0); expect(r.r).toBeCloseTo(1);
  });
  it("summary of 1..5", () => { const s = summary([1, 2, 3, 4, 5]); expect(s.mean).toBe(3); expect(s.median).toBe(3); expect(s.sd).toBeCloseTo(Math.SQRT2); });
  it("Newton–Raphson finds √2 to 1e-10", () => {
    const r = newton("y = x^2 - 2", 1);
    expect(r.root).not.toBeNull(); expect(Math.abs(r.root! - Math.SQRT2)).toBeLessThan(1e-10);
  });
  it("Newton stops on a flat tangent", () => { expect(newton("y = x^2 - 2", 0).root).toBeNull(); });
  it("bisection halves the interval each step", () => {
    const r = bisection("y = x^2 - 2", 0, 2);
    for (const s of r.steps.slice(1)) expect(s.b - s.a).toBeCloseTo((r.steps[s.n - 1].b - r.steps[s.n - 1].a) / 2);
    expect(r.root!).toBeCloseTo(Math.SQRT2, 7);
  });
  it("bisection refuses without a sign change", () => { expect(bisection("y = x^2 + 1", -1, 1).root).toBeNull(); });
  it("reflecting twice returns the original shape", () => {
    const tri: [number, number][] = [[1, 2], [3, 1], [2, 5]];
    for (const line of ["x-axis", "y-axis", "y=x", "y=-x"] as const)
      expect(applyTransform(applyTransform(tri, { kind: "reflect", line }), { kind: "reflect", line })).toEqual(tri);
  });
  it("rotating (1,0) by 90° gives (0,1)", () => { expect(applyTransform([[1, 0]], { kind: "rotate", deg: 90, cx: 0, cy: 0 })).toEqual([[0, 1]]); });
  it("ellipse focal distances add to 2a", () => {
    const c = conic("ellipse", 5, 3);
    const p: [number, number] = [5 * Math.cos(1), 3 * Math.sin(1)];
    expect(dist(p, c.foci[0]) + dist(p, c.foci[1])).toBeCloseTo(10);
  });
});
