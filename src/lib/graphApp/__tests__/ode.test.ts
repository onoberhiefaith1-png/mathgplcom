import { describe, it, expect } from "vitest";
import { slopeFn, exactSolution, euler, rk4, linearConstant } from "../ode";
describe("Phase 7 differential equations", () => {
  it("solves dy/dx = y with y(0)=1 as e^x", () => { const s = exactSolution(slopeFn("dy/dx = y"), 0, 1)!; expect(s.value(1)).toBeCloseTo(Math.E); });
  it("solves dy/dx = -2y + 4 towards equilibrium 2", () => { const s = exactSolution(slopeFn("-2y + 4"), 0, 0)!; expect(s.value(0)).toBeCloseTo(0); expect(s.value(10)).toBeCloseTo(2); });
  it("does not claim exact solutions for non-linear equations", () => expect(linearConstant(slopeFn("x*y"))).toBeNull());
  it("Euler for dy/dx = y, h = 0.5, two steps gives 2.25", () => expect(euler(slopeFn("y"), 0, 1, 0.5, 2)[2].y).toBeCloseTo(2.25));
  it("RK4 matches e^(x²/2) for dy/dx = xy", () => { const p = rk4(slopeFn("x*y"), 0, 1, 1); expect(p[p.length - 1][1]).toBeCloseTo(Math.exp(0.5), 6); });
  it("rejects unknown symbols", () => expect(() => slopeFn("q + y")).toThrow(/Unknown/));
});
import { rk4Steps, equilibria, systemFn, rk4System } from "../ode";
describe("Stage 10 differential equations", () => {
  it("RK4 for dy/dx = y reaches e at x = 1 within 1e-6 (h = 0.1)", () => expect(Math.abs(rk4Steps(slopeFn("y"), 0, 1, 0.1, 10)[10].y - Math.E)).toBeLessThan(1e-5));
  it("Euler error roughly halves when h halves", () => { const e1 = Math.abs(euler(slopeFn("y"), 0, 1, 0.1, 10)[10].y - Math.E), e2 = Math.abs(euler(slopeFn("y"), 0, 1, 0.05, 20)[20].y - Math.E); expect(e1 / e2).toBeGreaterThan(1.8); expect(e1 / e2).toBeLessThan(2.2); });
  it("logistic equilibria: 0 unstable, K = 4 stable", () => { const e = equilibria(slopeFn("y*(1 - y/4)"))!; expect(e.find(q => Math.abs(q.y) < 1e-6)!.stable).toBe(false); expect(e.find(q => Math.abs(q.y - 4) < 1e-6)!.stable).toBe(true); });
  it("equilibria are not claimed when f depends on x", () => expect(equilibria(slopeFn("x - y"))).toBeNull());
  it("cooling settles at room temperature 2", () => { const p = rk4(slopeFn("-0.5*(y - 2)"), 0, 9, 40); expect(p[p.length - 1][1]).toBeCloseTo(2, 4); });
  it("prey with no predators grows like e^t", () => { const p = rk4System(systemFn("x - 0.5*x*y", "0.5*x*y - y"), 1, 0, 2); expect(p[p.length - 1][1]).toBeCloseTo(Math.exp(2), 4); });
  it("undamped spring returns to its start after one period 2π/ω", () => { const p = rk4System(systemFn("y", "-4*x"), 3, 0, Math.PI); const [, x, y] = p[p.length - 1]; expect(x).toBeCloseTo(3, 4); expect(y).toBeCloseTo(0, 4); });
});
