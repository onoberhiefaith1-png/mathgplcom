import { describe, expect, it } from "vitest";
import { LIBRARY } from "../library";
import { parseEquation } from "../math";
import { fnOf } from "../calculus";
import { integrate } from "../operations";
import { eigen, multiplySteps } from "../linalg";
import { binomialPmf, normalCdf } from "../probability";
import { newton } from "../numerical";

/**
 * Stage 12 accuracy review: every Equation Library entry must parse, and the
 * engines behind the library must match known textbook answers. An advanced
 * result that cannot be verified here should be flagged for a mathematician.
 */
describe("Equation Library accuracy review", () => {
  it("every library entry parses without an error", () => {
    for (const entry of LIBRARY) {
      if (entry.tab === "Matrices") continue; // matrix entries open the matrix tool, not the parser
      if (entry.expr.startsWith("ncube:")) continue; // hypercube entries switch to ND mode directly
      const parsed = parseEquation(entry.expr);
      expect(parsed.kind, `library entry "${entry.label}" (${entry.expr})`).not.toBe("error");
    }
  });

  it("plotted curves evaluate to known values", () => {
    expect(fnOf("y = x^2")(3)).toBeCloseTo(9, 9);
    expect(fnOf("y = sin(x)")(Math.PI / 2)).toBeCloseTo(1, 9);
  });

  it("calculus answers match known results", () => {
    const f = fnOf("y = x^3");
    expect((f(2.0001) - f(1.9999)) / 0.0002).toBeCloseTo(12, 2); // d/dx x³ = 3x²
    expect(integrate("y = x^2", 0, 3).value).toBeCloseTo(9, 4); // ∫x² = x³/3
    expect(integrate("y = sin(x)", 0, Math.PI).value).toBeCloseTo(2, 4);
  });

  it("linear algebra answers match known results", () => {
    const { real } = eigen([[2, 0], [0, 3]]);
    expect(real.map((e) => e.value).sort((a, b) => a - b)).toEqual([2, 3]);
    expect(multiplySteps([[1, 2], [3, 4]], [[5, 6], [7, 8]]).result).toEqual([[19, 22], [43, 50]]);
  });

  it("probability answers match known results", () => {
    expect(binomialPmf(10, 0.5, 5)).toBeCloseTo(0.24609375, 9);
    expect(normalCdf(0, 0, 1)).toBeCloseTo(0.5, 9);
    expect(normalCdf(1, 0, 1) - normalCdf(-1, 0, 1)).toBeCloseTo(0.6827, 3);
  });

  it("numerical methods converge to known roots", () => {
    expect(newton("x^2 - 2", 1).root).toBeCloseTo(Math.SQRT2, 6);
  });
});
