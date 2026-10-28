import { describe, expect, it } from "vitest";
import { CONCEPTS, fourierSquareWave, matchConcept } from "../concepts";
import { parseEquation } from "../math";

describe("concept registry", () => {
  it("matches typed phrases to concepts", () => {
    expect(matchConcept("eigenvalues")?.id).toBe("eigenvalues");
    expect(matchConcept("binomial distribution")?.id).toBe("binomial");
    expect(matchConcept("Riemann sums")?.id).toBe("riemann");
    expect(matchConcept("Fourier series")?.id).toBe("fourier");
    expect(matchConcept("4D geometry")?.id).toBe("4d");
    expect(matchConcept("taylor series")?.id).toBe("taylor");
    expect(matchConcept("normal distribution")?.id).toBe("normal");
  });

  it("does not match equations or unknown words", () => {
    expect(matchConcept("y = x^2")).toBeNull();
    expect(matchConcept("quantum knitting")).toBeNull();
  });

  it("fourier square wave uses odd harmonics with 1/m amplitudes", () => {
    expect(fourierSquareWave(3)).toBe("y = sin(x) + sin(3x)/3 + sin(5x)/5");
    const eq = parseEquation(fourierSquareWave(2));
    expect(eq.kind).toBe("curve2d");
    if (eq.kind === "curve2d") {
      // At x = π/2 the 2-term sum is sin(π/2) + sin(3π/2)/3 = 1 - 1/3.
      expect(eq.f({ x: Math.PI / 2 })).toBeCloseTo(1 - 1 / 3, 9);
    }
  });

  it("binomial concept plots n+1 points whose probabilities sum to 1", () => {
    const c = CONCEPTS.find(c => c.id === "binomial")!;
    const action = c.run({ n: "8", p: "0.25" });
    expect(action.plots).toHaveLength(9);
    const total = action.plots!.reduce((s, p) => s + Number(p.match(/, ([\d.e-]+)\)$/)![1]), 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("eigenvalue concept loads a changed matrix, not a hard-coded one", () => {
    const c = CONCEPTS.find(c => c.id === "eigenvalues")!;
    expect(c.run({ a: "[3 0; 0 5]" }).matrix).toEqual([[3, 0], [0, 5]]);
  });

  it("4D concept clamps the dimension to 4–6", () => {
    const c = CONCEPTS.find(c => c.id === "4d")!;
    expect(c.run({ n: "9" }).nd).toBe(6);
    expect(c.run({ n: "2" }).nd).toBe(4);
  });
});
