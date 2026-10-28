import { describe, it, expect } from "vitest";
import { parseEquation } from "../math";
import { curveFeatures } from "../interpret";
import { verifyCurve, verifyImplicit, domainWarnings } from "../verify";
import { JOURNEYS, checkAnswer } from "../journeys";

const fn = (s: string) => { const e = parseEquation(s); if (e.kind !== "curve2d" && e.kind !== "implicit2d") throw new Error(s); return e.f; };

describe("Stage 18 verification layer", () => {
  it("plotted roots and vertex of y = x^2 - 6x + 5 are confirmed", () => {
    const f = fn("y = x^2 - 6x + 5");
    const v = verifyCurve(f, curveFeatures(f));
    expect(v.ok).toBe(true);
    expect(v.checks.filter(c => c.label.includes("root"))).toHaveLength(2);
  });
  it("a false root is caught", () => {
    const f = fn("y = x^2 - 4");
    const c = curveFeatures(f);
    expect(verifyCurve(f, { ...c, roots: [3] }).ok).toBe(false);
  });
  it("sampled circle points satisfy x^2 + y^2 = 25", () => expect(verifyImplicit(fn("x^2 + y^2 = 25")).ok).toBe(true));
  it("an empty implicit curve is reported honestly", () => {
    const v = verifyImplicit(fn("x^2 + y^2 = -1"));
    expect(v.ok).toBe(false);
    expect(v.warnings[0]).toMatch(/No points/);
  });
  it("sqrt(x) warns it is undefined for negative x", () => expect(domainWarnings(fn("y = sqrt(x)")).join(" ")).toMatch(/Undefined/));
  it("1/x warns about an asymptote", () => expect(domainWarnings(fn("y = 1/(x - 0.0005)")).join(" ")).toMatch(/asymptote|Undefined/));
  it("x^2 has no warnings", () => expect(domainWarnings(fn("y = x^2"))).toEqual([]));
});

describe("every reference journey holds on unseen numbers", () => {
  for (const journey of JOURNEYS) for (const seed of [1, 7, 42]) {
    it(`${journey.id} seed ${seed}: engine answers pass their own check`, () => {
      for (const step of journey.build(seed)) {
        if (!step.answer?.length) continue;
        const typed = step.answer.length > 1 ? `(${step.answer.join(", ")})` : String(step.answer[0]);
        expect(checkAnswer(step, typed)).toBe(true);
      }
    });
  }
});
