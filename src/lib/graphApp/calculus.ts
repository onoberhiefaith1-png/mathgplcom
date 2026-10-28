// Math Lab Phase 4 — calculus engine. Pure, on-device, no AI.
// Exact results come from mathjs symbolic algebra; everything else is
// labelled as a numerical approximation.
import { derivative, rationalize, simplify } from "mathjs";
import { curveExpression } from "./operations";
import { parseEquation } from "./math";

type F = (x: number) => number;
const fmt = (n: number) => (Math.abs(n) < 1e-10 ? "0" : Number(n.toPrecision(8)).toString());

/** Accepts "x^2", "y = x^2" or "f(x) = x^2" and returns "y = …". */
export function curveSource(input: string): string {
  const s = input.trim().replace(/^f\s*\(\s*x\s*\)\s*=/i, "y =");
  return s.includes("=") ? s : `y = ${s}`;
}

/** Replace the parameter `a` with a number so sliders can explore families. */
export function withParameter(src: string, a: number): string {
  return src.replace(/\ba\b/g, `(${a})`);
}

export function fnOf(src: string): F {
  const eq = parseEquation(src);
  if (eq.kind !== "curve2d") throw Error("Select an explicit curve y = f(x).");
  return (x) => eq.f({ x });
}

function clean(expr: string): string { return simplify(expr).toString(); }

export function derivativeSteps(src: string): { first: string; second: string; steps: string[] } {
  const f = curveExpression(src);
  const first = clean(derivative(f, "x").toString());
  const second = clean(derivative(first, "x").toString());
  return { first, second, steps: [`f(x) = ${f}`, `Differentiate each term with respect to x.`, `f′(x) = ${first}`, `Differentiate again for the rate of change of the gradient.`, `f″(x) = ${second}`] };
}

/** Exact antiderivative for polynomials; otherwise null (numerical only). */
export function antiderivative(src: string): { result: string; steps: string[] } | null {
  const f = curveExpression(src);
  let coeffs: number[];
  try {
    const r = rationalize(f, {}, true) as unknown as { coefficients: unknown[]; variables: string[] };
    if (r.variables.length > 1 || (r.variables.length === 1 && r.variables[0] !== "x")) return null;
    coeffs = (r.coefficients.length ? r.coefficients : [0]).map(Number);
    if (coeffs.some((c) => !Number.isFinite(c))) return null;
    // rationalize only keeps polynomials when the denominator is constant.
    if (/\//.test(f) && !/^[^x]*$/.test(f.split("/").slice(1).join("/"))) return null;
  } catch { return null; }
  const terms = coeffs.map((c, n) => ({ c: c / (n + 1), p: n + 1 })).filter((t) => t.c !== 0).reverse();
  const term = ({ c, p }: { c: number; p: number }) => `${fmt(c)}${p === 1 ? " x" : ` x^${p}`}`;
  const result = (terms.length ? terms.map(term).join(" + ").replace(/\+ -/g, "- ") : "0") + " + C";
  return { result, steps: [`∫ (${f}) dx`, `Raise each power of x by one and divide by the new power: ∫ xⁿ dx = xⁿ⁺¹ / (n + 1).`, `= ${result}`, `C is the constant of integration.`] };
}

/** Two-sided numerical limit, with left/right values and a continuity verdict. */
export function limitAt(src: string, a: number): { left: number; right: number; value: number | null; fa: number; continuous: boolean; text: string } {
  if (!Number.isFinite(a)) throw Error("Enter a finite x-value.");
  const f = fnOf(src);
  const side = (dir: 1 | -1) => { let v = NaN; for (let k = 3; k <= 9; k++) { const y = f(a + dir * 10 ** -k); if (Number.isFinite(y)) v = y; } return v; };
  const left = side(-1), right = side(1), fa = f(a);
  const tol = 1e-4 * Math.max(1, Math.abs(left), Math.abs(right));
  const value = Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tol ? (left + right) / 2 : null;
  const continuous = value !== null && Number.isFinite(fa) && Math.abs(fa - value) <= tol;
  const text = value === null
    ? `Left limit ≈ ${fmt(left)}, right limit ≈ ${fmt(right)}: the limit does not exist at x = ${fmt(a)}.`
    : `lim x→${fmt(a)} f(x) ≈ ${fmt(value)} (numerical). ${continuous ? "f is continuous here." : Number.isFinite(fa) ? `f(${fmt(a)}) = ${fmt(fa)}, so f is discontinuous here.` : `f(${fmt(a)}) is undefined: a removable discontinuity.`}`;
  return { left, right, value, fa, continuous, text };
}

export interface KeyPoint { x: number; y: number; kind: "maximum" | "minimum" | "stationary inflection" | "inflection" }

/** Sign-change scan + bisection for f′ = 0 and f″ = 0 on [lo, hi]. */
export function keyPoints(src: string, lo = -10, hi = 10): KeyPoint[] {
  const { first, second } = derivativeSteps(src);
  const f = fnOf(src), d1 = fnOf(`y = ${first}`), d2 = fnOf(`y = ${second}`);
  const roots = (g: F) => {
    const out: number[] = []; const n = 2000, h = (hi - lo) / n;
    let px = lo, py = g(lo);
    if (Math.abs(py) < 1e-12) out.push(lo);
    for (let i = 1; i <= n; i++) {
      const x = lo + i * h, y = g(x);
      if (Math.abs(y) < 1e-12) { if (!out.length || Math.abs(out[out.length - 1] - x) > h * 1.5) out.push(x); }
      else if (Number.isFinite(py) && Number.isFinite(y) && py * y < 0 && Math.abs(py) < 1e6 && Math.abs(y) < 1e6) {
        let a = px, b = x; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (g(a) * g(m) <= 0) b = m; else a = m; }
        out.push((a + b) / 2);
      }
      px = x; py = y;
    }
    return out.map((r) => (Math.abs(r - Math.round(r * 1e6) / 1e6) < 1e-7 ? Math.round(r * 1e6) / 1e6 : r));
  };
  const pts: KeyPoint[] = [];
  const e = 1e-3;
  for (const x of roots(d1)) {
    const l = d1(x - e), r = d1(x + e);
    const kind = l > 0 && r < 0 ? "maximum" : l < 0 && r > 0 ? "minimum" : "stationary inflection";
    pts.push({ x, y: f(x), kind });
  }
  for (const x of roots(d2)) {
    if (d2(x - e) * d2(x + e) < 0 && !pts.some((p) => Math.abs(p.x - x) < 1e-6)) pts.push({ x, y: f(x), kind: "inflection" });
  }
  return pts.filter((p) => Number.isFinite(p.y)).sort((a, b) => a.x - b.x);
}

export type RiemannMethod = "left" | "right" | "midpoint" | "trapezium";
export function riemann(src: string, a: number, b: number, n: number, method: RiemannMethod): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) throw Error("Enter two different finite bounds.");
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw Error("Use between 1 and 1000 strips.");
  const f = fnOf(src), h = (b - a) / n; let s = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h, x1 = x0 + h;
    const y = method === "left" ? f(x0) : method === "right" ? f(x1) : method === "midpoint" ? f((x0 + x1) / 2) : (f(x0) + f(x1)) / 2;
    if (!Number.isFinite(y)) throw Error("The curve is undefined inside these bounds.");
    s += y * h;
  }
  return s;
}

/** Outline of Riemann strips as a 2D parametric curve (t is clamped to [a, b]). */
export function riemannEquation(src: string, a: number, b: number, n: number, method: Exclude<RiemannMethod, "trapezium">): string {
  const f = curveExpression(src); const h = (b - a) / n; const c = method === "left" ? 0 : method === "right" ? 1 : 0.5;
  const x = `min(${Math.max(a, b)}, max(${Math.min(a, b)}, t))`;
  const sample = `(${a} + min(${n - 1}, floor((${x} - ${a}) / ${h})) * ${h} + ${c * h})`;
  return `x = ${x}; y = ${f.replace(/\bx\b/g, sample)}`;
}

/** Closed outline of the region between y = f and y = g (g defaults to the x-axis). */
export function areaEquation(src: string, a: number, b: number, other?: string): string {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) throw Error("Enter two different finite bounds.");
  const f = curveExpression(src), g = other ? curveExpression(other) : "0";
  const lo = Math.min(a, b), w = Math.max(a, b) - lo;
  const u = "min(2, max(0, t))";
  const fwd = `(${lo} + ${w} * ${u})`, back = `(${lo} + ${w} * (2 - ${u}))`;
  return `x = (${u} < 1 ? ${fwd} : ${back}); y = (${u} < 1 ? (${f.replace(/\bx\b/g, fwd)}) : (${g.replace(/\bx\b/g, back)}))`;
}

/** Signed area between f and g on [a, b] with Simpson's rule. */
export function areaBetween(src: string, other: string, a: number, b: number): number {
  const f = fnOf(src), g = fnOf(other); const n = 2000, h = (b - a) / n; let s = 0;
  for (let i = 0; i <= n; i++) { const x = a + i * h, y = Math.abs(f(x) - g(x)); if (!Number.isFinite(y)) throw Error("A curve is undefined inside these bounds."); s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * y; }
  return Math.abs(s * h / 3);
}

export const formatNumber = fmt;
