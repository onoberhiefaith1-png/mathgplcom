import { describe, it, expect } from "vitest";
import {
  sequenceFn, sequenceTerms, convergesTo, geometricRatio, powerLaw, alternating,
  seriesReport, epsilonN, fnOfX, numericalLimit, epsilonDelta, continuityAt,
  taylorCoeffs, taylorValue, taylorExpression, classicNote,
} from "../analysis";

describe("Phase 9 real analysis — sequences and series", () => {
  it("1/2^n converges to 0", () => {
    const v = convergesTo(sequenceTerms(sequenceFn("1/2^n"), 40));
    expect(v.kind).toBe("convergent");
    if (v.kind === "convergent") expect(v.limit).toBeCloseTo(0, 9);
  });
  it("(-1)^n never settles", () => {
    expect(convergesTo(sequenceTerms(sequenceFn("(-1)^n"), 40)).kind).toBe("oscillating");
  });
  it("n^2 grows without bound", () => {
    const v = convergesTo(sequenceTerms(sequenceFn("n^2"), 40));
    expect(v.kind).toBe("divergent");
  });
  it("detects a geometric ratio 1/2", () => {
    const g = geometricRatio(sequenceTerms(sequenceFn("1/2^n"), 20));
    expect(g).not.toBeNull();
    expect(g!.r).toBeCloseTo(0.5, 9);
  });
  it("Σ1/2^n converges with exact sum a/(1−r) = 1", () => {
    const r = seriesReport(sequenceFn("1/2^n"), 30);
    expect(r.exact).toBeDefined();
    expect(r.rows[r.rows.length - 1].sum).toBeCloseTo(1, 6);
    expect(r.verdict).toMatch(/converges/);
  });
  it("the harmonic series is reported divergent", () => {
    const r = seriesReport(sequenceFn("1/n"), 100);
    expect(r.verdict).toMatch(/diverges/);
    expect(r.verdict).toMatch(/p ≤ 1|harmonic/);
  });
  it("Σ1/n² is a convergent p-series with sum π²/6", () => {
    const r = seriesReport(sequenceFn("1/n^2"), 80);
    expect(r.verdict).toMatch(/p = 2 > 1|converges/);
    expect(r.exact).toMatch(/π²\/6/);
    expect(r.rows[r.rows.length - 1].sum).toBeCloseTo(1.6449, 1);
  });
  it("(-1)^n/n converges by alternation with an error bound", () => {
    const r = seriesReport(sequenceFn("(-1)^n/n"), 60);
    expect(r.verdict).toMatch(/converges/);
    expect(r.verdict).toMatch(/within ±/);
    expect(alternating(sequenceTerms(sequenceFn("(-1)^n/n"), 30))).toBe(true);
  });
  it("powerLaw finds p = 2, c = 1 for 1/n²", () => {
    const pw = powerLaw(sequenceTerms(sequenceFn("1/n^2"), 40));
    expect(pw).not.toBeNull();
    expect(pw!.p).toBeCloseTo(2, 3);
    expect(pw!.c).toBeCloseTo(1, 3);
  });
});

describe("Phase 9 real analysis — ε–N band", () => {
  it("ε = 0.01 for 1/2^n needs N = 7", () => {
    const terms = sequenceTerms(sequenceFn("1/2^n"), 30);
    const r = epsilonN(terms, 0, 0.01);
    expect(r.n).toBe(7);
    expect(r.flags[6]).toBe(true);
    expect(r.flags[5]).toBe(false);
  });
  it("no N when ε is smaller than any term gap", () => {
    const r = epsilonN(sequenceTerms(sequenceFn("1/n"), 50), 0, 1e-12);
    expect(r.n).toBeNull();
  });
});

describe("Phase 9 real analysis — ε–δ limits and continuity", () => {
  it("f = 2x + 1 at a = 1 has limit 3 and δ ≈ 0.05 for ε = 0.1", () => {
    const f = fnOfX("2x + 1");
    expect(numericalLimit(f, 1).limit).toBeCloseTo(3, 6);
    const r = epsilonDelta(f, 1, 0.1);
    expect(r.delta).not.toBeNull();
    expect(r.delta!).toBeCloseTo(0.05, 2);
    expect(r.working.some(s => /guarantees/.test(s))).toBe(true);
  });
  it("sign(x) at 0 allows no δ (jump)", () => {
    const r = epsilonDelta(fnOfX("sign(x)"), 0, 0.5);
    expect(r.delta).toBeNull();
  });
  it("sin(1/x) has no limit at 0", () => {
    const lim = numericalLimit(fnOfX("sin(1/x)"), 0);
    expect(lim.exists).toBe(false);
  });
  it("|x| is continuous at 0 — the ε–δ definition still works", () => {
    const f = fnOfX("abs(x)");
    expect(continuityAt(f, 0).continuous).toBe(true);
    expect(epsilonDelta(f, 0, 0.5).delta).not.toBeNull();
  });
  it("1/x at 0 is undefined with no limit", () => {
    const v = continuityAt(fnOfX("1/x"), 0);
    expect(v.continuous).toBe(false);
    expect(v.defined).toBe(false);
    expect(v.limitExists).toBe(false);
  });
  it("a hole: limit exists but the point is undefined", () => {
    const v = continuityAt(fnOfX("(x^2 - 1)/(x - 1)"), 1);
    expect(v.limitExists).toBe(true);
    expect(v.defined).toBe(false);
    expect(v.continuous).toBe(false);
  });
});

describe("Phase 9 real analysis — Taylor polynomials", () => {
  it("e^x at 0, degree 3: 1 + x + x²/2 + x³/6", () => {
    const c = taylorCoeffs(fnOfX("exp(x)"), 0, 3);
    expect(c.map(t => t.coef)).toEqual([expect.closeTo(1, 4), expect.closeTo(1, 4), expect.closeTo(0.5, 4), expect.closeTo(1 / 6, 4)]);
  });
  it("sin x at 0, degree 5: x − x³/6 + x⁵/120", () => {
    const c = taylorCoeffs(fnOfX("sin(x)"), 0, 5);
    expect(c[1].coef).toBeCloseTo(1, 4);
    expect(c[3].coef).toBeCloseTo(-1 / 6, 4);
    expect(c[5].coef).toBeCloseTo(1 / 120, 4);
    expect(c[0].coef).toBeCloseTo(0, 4);
  });
  it("the polynomial hugs the function near the centre", () => {
    const c = taylorCoeffs(fnOfX("sin(x)"), 0, 5);
    expect(taylorValue(c, 0, 0.3)).toBeCloseTo(Math.sin(0.3), 4);
    expect(taylorValue(c, 0, 0.8)).toBeCloseTo(Math.sin(0.8), 3);
  });
  it("centres away from 0 write (x − x₀) powers", () => {
    const c = taylorCoeffs(fnOfX("exp(x)"), 1, 2);
    expect(taylorExpression(c, 1)).toMatch(/x - 1/);
  });
  it("labels classic series", () => {
    expect(classicNote(taylorCoeffs(fnOfX("sin(x)"), 0, 5), 0)).toMatch(/sin/);
    expect(classicNote(taylorCoeffs(fnOfX("exp(x)"), 0, 4), 0)).toMatch(/e\^x/);
    expect(classicNote(taylorCoeffs(fnOfX("x^2"), 2, 2), 2)).toBeNull();
  });
});
