// Root finding for Math Lab — pure, step by step.
import { derivative } from "mathjs";
import { parseEquation } from "./math";
import { curveExpression } from "./operations";

const curve = (src: string) => {
  const eq = parseEquation(src.includes("=") ? src : `y = ${src}`);
  if (eq.kind !== "curve2d") throw Error("Enter a curve y = f(x).");
  return eq.f;
};

export interface NewtonStep { n: number; x: number; fx: number; dfx: number; next: number }
export function newton(src: string, x0: number, tol = 1e-10, max = 30): { steps: NewtonStep[]; root: number | null; message: string } {
  const full = src.includes("=") ? src : `y = ${src}`;
  const f = curve(full);
  const d = parseEquation(`y = ${derivative(curveExpression(full), "x").toString()}`);
  if (d.kind !== "curve2d") throw Error("Cannot differentiate this curve.");
  const steps: NewtonStep[] = [];
  let x = x0;
  for (let n = 0; n < max; n++) {
    const fx = f({ x }), dfx = d.f({ x });
    if (!Number.isFinite(fx) || !Number.isFinite(dfx)) return { steps, root: null, message: "The function is undefined here — try another start." };
    if (Math.abs(dfx) < 1e-14) return { steps, root: null, message: "The tangent is flat (f′(x) = 0), so Newton's method stops." };
    const next = x - fx / dfx;
    steps.push({ n, x, fx, dfx, next });
    if (Math.abs(next - x) < tol) return { steps, root: next, message: `Converged in ${n + 1} steps.` };
    x = next;
  }
  return { steps, root: null, message: `Did not converge in ${max} steps.` };
}

export interface BisectStep { n: number; a: number; b: number; m: number; fm: number }
export function bisection(src: string, a0: number, b0: number, tol = 1e-8, max = 60): { steps: BisectStep[]; root: number | null; message: string } {
  const f = curve(src);
  let a = Math.min(a0, b0), b = Math.max(a0, b0);
  const fa0 = f({ x: a }), fb0 = f({ x: b });
  if (fa0 * fb0 > 0) return { steps: [], root: null, message: "f(a) and f(b) have the same sign — no sign change, so bisection cannot start." };
  let fa = fa0;
  const steps: BisectStep[] = [];
  for (let n = 0; n < max; n++) {
    const m = (a + b) / 2, fm = f({ x: m });
    steps.push({ n, a, b, m, fm });
    if (fm === 0 || (b - a) / 2 < tol) return { steps, root: m, message: `Converged in ${n + 1} steps.` };
    if (fa * fm < 0) b = m; else { a = m; fa = fm; }
  }
  return { steps, root: null, message: `Did not converge in ${max} steps.` };
}
