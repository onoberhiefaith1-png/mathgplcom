import { describe, it, expect } from "vitest";
import { antiderivative, areaBetween, areaEquation, curveSource, derivativeSteps, keyPoints, limitAt, riemann, riemannEquation, withParameter } from "../calculus";
import { parseEquation } from "../math";

describe("Math Lab calculus (Phase 4)", () => {
  it("reads f(x) and bare expressions", () => { expect(curveSource("f(x) = x^2")).toBe("y = x^2"); expect(curveSource("x^3")).toBe("y = x^3"); });
  it("substitutes the parameter a", () => expect(withParameter("y = a x^2", 3)).toBe("y = (3) x^2"));
  it("gives first and second derivatives of x^3", () => { const d = derivativeSteps("y = x^3"); expect(d.first).toBe("3 * x ^ 2"); expect(d.second).toBe("6 * x"); });
  it("integrates polynomials exactly", () => expect(antiderivative("y = 3x^2 + 2")?.result).toBe("1 x^3 + 2 x + C"));
  it("refuses an exact antiderivative for non-polynomials", () => expect(antiderivative("y = sin(x)")).toBeNull());
  it("finds a removable discontinuity", () => { const l = limitAt("y = (x^2 - 1)/(x - 1)", 1); expect(l.value).toBeCloseTo(2, 4); expect(l.continuous).toBe(false); });
  it("detects a missing limit", () => expect(limitAt("y = 1/x", 0).value).toBeNull());
  it("classifies stationary and inflection points of x^3 - 3x", () => {
    const p = keyPoints("y = x^3 - 3x", -5, 5);
    expect(p.map((k) => [k.x, k.kind])).toEqual([[-1, "maximum"], [0, "inflection"], [1, "minimum"]]);
  });
  it("approximates ∫₀³ x² with Riemann sums", () => {
    expect(riemann("y = x^2", 0, 3, 3, "left")).toBe(5);
    expect(riemann("y = x^2", 0, 3, 3, "right")).toBe(14);
    expect(riemann("y = x^2", 0, 3, 300, "midpoint")).toBeCloseTo(9, 3);
  });
  it("draws strip and area outlines", () => {
    const s = parseEquation(riemannEquation("y = x^2", 0, 3, 3, "left")); if (s.kind !== "parametric") throw Error();
    expect(s.fy({ t: 1.5 })).toBe(1);
    const a = parseEquation(areaEquation("y = x", 0, 2, "y = x^2")); if (a.kind !== "parametric") throw Error();
    expect(a.fy({ t: 0.5 })).toBe(1); expect(a.fy({ t: 1.5 })).toBe(1);
  });
  it("measures area between y = x and y = x^2", () => expect(areaBetween("y = x", "y = x^2", 0, 1)).toBeCloseTo(1 / 6, 6));
});
