import { describe, it, expect } from "vitest";
import { eigen, multiplySteps, solveSystem } from "../linalg";
describe("Phase 6 linear algebra", () => {
  it("finds eigenvalues 5 and 2 of [[4,1],[2,3]] with A v = λ v", () => {
    const a = [[4, 1], [2, 3]], r = eigen(a);
    expect(r.real.map(e => e.value).sort()).toEqual([2, 5]);
    for (const { value, vector: [x, y] } of r.real) { expect(4 * x + y).toBeCloseTo(value * x); expect(2 * x + 3 * y).toBeCloseTo(value * y); }
  });
  it("reports a rotation as having no real eigenvalues", () => expect(eigen([[0, -1], [1, 0]]).complex).toBe(true));
  it("handles 3×3 diagonal matrix", () => expect(eigen([[2, 0, 0], [0, 3, 0], [0, 0, 4]]).real.map(e => e.value).sort()).toEqual([2, 3, 4]));
  it("multiplies with entry steps", () => { const r = multiplySteps([[1, 2], [3, 4]], [[5, 6], [7, 8]]); expect(r.result).toEqual([[19, 22], [43, 50]]); expect(r.steps[0]).toBe("(1,1): 1×5 + 2×7 = 19"); });
  it("solves systems and rejects singular ones", () => {
    const x = solveSystem([[2, 1], [1, 3]], [5, 10]); expect(x[0]).toBeCloseTo(1); expect(x[1]).toBeCloseTo(3);
    expect(() => solveSystem([[1, 2], [2, 4]], [1, 2])).toThrow(/no unique/);
  });
});
