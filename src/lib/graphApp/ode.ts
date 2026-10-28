// Math Lab first-order differential equations dy/dx = f(x, y). Pure, on-device, no AI.
import { compile, parse } from "mathjs";
import { normalise } from "./math";
import { fmt } from "./linalg";

export type Slope = (x: number, y: number) => number;
const ALLOWED = ["x", "y", "e", "pi", "sin", "cos", "tan", "sqrt", "abs", "log", "exp"];

export function slopeFn(src: string): Slope {
  const body = normalise(src.includes("=") ? src.slice(src.indexOf("=") + 1) : src).replace(/LOG10\(/g, "log10(");
  if (!body) throw Error("Enter the right-hand side f(x, y).");
  parse(body).traverse(n => { if (n.type === "SymbolNode" && !ALLOWED.includes(String((n as unknown as { name: string }).name))) throw Error(`Unknown symbol: ${(n as unknown as { name: string }).name}`); });
  const code = compile(body);
  return (x, y) => { try { const v = code.evaluate({ x, y, e: Math.E, pi: Math.PI }); return typeof v === "number" ? v : NaN; } catch { return NaN; } };
}

/** Detect dy/dx = a·y + b with constant a, b by sampling. */
export function linearConstant(f: Slope): { a: number; b: number } | null {
  const b = f(0, 0), a = f(0, 1) - b;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  for (const [x, y] of [[1.3, -2], [-2.7, 3.1], [4, 0.5], [-1, -4]]) if (Math.abs(f(x, y) - (a * y + b)) > 1e-9 * (1 + Math.abs(a * y + b))) return null;
  return { a, b };
}

export interface ExactSolution { equation: string; steps: string[]; value: (x: number) => number }

export function exactSolution(f: Slope, x0: number, y0: number): ExactSolution | null {
  const lin = linearConstant(f); if (!lin) return null;
  const { a, b } = lin;
  if (Math.abs(a) < 1e-12) return { equation: `y = ${fmt(y0)} + ${fmt(b)}(x - ${fmt(x0)})`, value: x => y0 + b * (x - x0), steps: [`dy/dx = ${fmt(b)} (constant)`, `Integrate both sides: y = ${fmt(b)}x + C`, `Use y(${fmt(x0)}) = ${fmt(y0)}: C = ${fmt(y0 - b * x0)}`, `y = ${fmt(b)}x + ${fmt(y0 - b * x0)}`] };
  const k = -b / a, A = y0 - k;
  return {
    equation: `y = ${fmt(k)} + (${fmt(A)}) * e^(${fmt(a)} * (x - ${fmt(x0)}))`,
    value: x => k + A * Math.exp(a * (x - x0)),
    steps: [
      `dy/dx = ${fmt(a)}y + ${fmt(b)}`,
      `Separate: dy / (${fmt(a)}y + ${fmt(b)}) = dx`,
      `Integrate: (1/${fmt(a)}) ln|${fmt(a)}y + ${fmt(b)}| = x + C`,
      `Rearrange: y = ${fmt(k)} + A·e^(${fmt(a)}x)`,
      `Use y(${fmt(x0)}) = ${fmt(y0)}: A·e^(${fmt(a * x0)}) = ${fmt(A)}`,
      `y = ${fmt(k)} + ${fmt(A)}·e^(${fmt(a)}(x − ${fmt(x0)}))`,
      Math.abs(b) > 1e-12 || true ? `Equilibrium: y = ${fmt(k)} is ${a < 0 ? "stable (solutions approach it)" : "unstable (solutions move away)"}.` : "",
    ],
  };
}

export interface StepRow { n: number; x: number; y: number; slope: number }

/** Euler's method with every step written out. */
export function euler(f: Slope, x0: number, y0: number, h: number, steps: number): StepRow[] {
  if (!(h !== 0 && Number.isFinite(h)) || steps < 1 || steps > 2000) throw Error("Choose a non-zero step size and 1–2000 steps.");
  const rows: StepRow[] = []; let x = x0, y = y0;
  for (let n = 0; n <= steps; n++) {
    const s = f(x, y); rows.push({ n, x, y, slope: s });
    if (!Number.isFinite(s) || !Number.isFinite(y)) throw Error(`The slope is undefined at x = ${fmt(x)}.`);
    y += h * s; x = x0 + (n + 1) * h;
  }
  return rows;
}

/** Classic RK4 — accurate numerical curve. */
export function rk4(f: Slope, x0: number, y0: number, x1: number, n = 400): [number, number][] {
  const h = (x1 - x0) / n, out: [number, number][] = [[x0, y0]]; let x = x0, y = y0;
  for (let i = 0; i < n; i++) {
    const k1 = f(x, y), k2 = f(x + h / 2, y + h * k1 / 2), k3 = f(x + h / 2, y + h * k2 / 2), k4 = f(x + h, y + h * k3);
    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h;
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) break;
    out.push([x, y]);
  }
  return out;
}

/** RK4 written out as table rows (same shape as Euler). */
export function rk4Steps(f: Slope, x0: number, y0: number, h: number, steps: number): StepRow[] {
  if (!(h !== 0 && Number.isFinite(h)) || steps < 1 || steps > 2000) throw Error("Choose a non-zero step size and 1–2000 steps.");
  const rows: StepRow[] = []; let x = x0, y = y0;
  for (let n = 0; n <= steps; n++) {
    rows.push({ n, x, y, slope: f(x, y) });
    const k1 = f(x, y), k2 = f(x + h / 2, y + h * k1 / 2), k3 = f(x + h / 2, y + h * k2 / 2), k4 = f(x + h, y + h * k3);
    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x = x0 + (n + 1) * h;
  }
  return rows;
}

export interface Equilibrium { y: number; stable: boolean | null }
/** Equilibria of an autonomous equation dy/dx = f(y); null when f depends on x. */
export function equilibria(f: Slope, lo = -20, hi = 20): Equilibrium[] | null {
  for (const y of [-2.3, 0.7, 3.1]) { const a = f(0, y), b = f(2.9, y), c = f(-4.1, y); if (Number.isFinite(a) && (Math.abs(a - b) > 1e-9 || Math.abs(a - c) > 1e-9)) return null; }
  const g = (y: number) => f(0, y), out: Equilibrium[] = [], N = 4000, d = (hi - lo) / N;
  const push = (r: number) => { if (!out.some(e => Math.abs(e.y - r) < 1e-6)) { const e = 1e-4, s = (g(r + e) - g(r - e)) / (2 * e); out.push({ y: Math.abs(r) < 1e-9 ? 0 : r, stable: Math.abs(s) < 1e-9 ? null : s < 0 }); } };
  for (let i = 0; i < N; i++) {
    let a = lo + i * d, b = a + d; const fa = g(a), fb = g(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) { push(a); continue; }
    if (fa * fb < 0) { let A = fa; for (let k = 0; k < 60; k++) { const m = (a + b) / 2, fm = g(m); if (A * fm <= 0) b = m; else { a = m; A = fm; } } push((a + b) / 2); }
  }
  return out;
}

export type System = (x: number, y: number) => [number, number];
export function systemFn(fSrc: string, gSrc: string): System { const f = slopeFn(fSrc), g = slopeFn(gSrc); return (x, y) => [f(x, y), g(x, y)]; }
/** RK4 for dx/dt = f, dy/dt = g. Returns [t, x, y] samples. */
export function rk4System(F: System, x0: number, y0: number, T: number, n = 800): [number, number, number][] {
  const h = T / n, out: [number, number, number][] = [[0, x0, y0]]; let x = x0, y = y0;
  for (let i = 1; i <= n; i++) {
    const [a1, b1] = F(x, y), [a2, b2] = F(x + h * a1 / 2, y + h * b1 / 2), [a3, b3] = F(x + h * a2 / 2, y + h * b2 / 2), [a4, b4] = F(x + h * a3, y + h * b3);
    x += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6; y += h * (b1 + 2 * b2 + 2 * b3 + b4) / 6;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) + Math.abs(y) > 1e6) break;
    out.push([i * h, x, y]);
  }
  return out;
}

export interface OdeModel { id: string; name: string; meaning: string; system: boolean; params: { key: string; label: string; value: number; min: number; max: number }[]; build: (p: Record<string, number>) => { f: string; g?: string; x0: number; y0: number; window: number } }
export const ODE_MODELS: OdeModel[] = [
  { id: "growth", name: "Growth / decay", system: false, meaning: "Money with interest or radioactive atoms: the rate is proportional to the amount. k > 0 grows, k < 0 decays.", params: [{ key: "k", label: "k", value: 0.3, min: -1, max: 1 }], build: p => ({ f: `${p.k}*y`, x0: 0, y0: 1, window: 5 }) },
  { id: "logistic", name: "Logistic", system: false, meaning: "A population or epidemic grows fast, then levels off at the carrying capacity K.", params: [{ key: "r", label: "r", value: 1, min: 0.1, max: 3 }, { key: "K", label: "K", value: 4, min: 1, max: 8 }], build: p => ({ f: `${p.r}*y*(1 - y/${p.K})`, x0: 0, y0: 0.5, window: Math.max(5, p.K + 1) }) },
  { id: "cooling", name: "Newton's cooling", system: false, meaning: "A cup of coffee cools towards room temperature T; it cools fastest when it is hottest.", params: [{ key: "k", label: "k", value: 0.5, min: 0.05, max: 2 }, { key: "T", label: "Room T", value: 2, min: -4, max: 4 }], build: p => ({ f: `-${p.k}*(y - (${p.T}))`, x0: 0, y0: 4.5, window: 5 }) },
  { id: "lv", name: "Predator–prey", system: true, meaning: "Rabbits (x) and foxes (y): more rabbits feed more foxes, more foxes eat more rabbits, so both cycle.", params: [{ key: "a", label: "a", value: 1, min: 0.2, max: 2 }, { key: "b", label: "b", value: 0.5, min: 0.1, max: 1 }, { key: "c", label: "c", value: 1, min: 0.2, max: 2 }, { key: "d", label: "d", value: 0.5, min: 0.1, max: 1 }], build: p => ({ f: `${p.a}*x - ${p.b}*x*y`, g: `${p.d}*x*y - ${p.c}*y`, x0: 3, y0: 1, window: 6 }) },
  { id: "spring", name: "Spring", system: true, meaning: "A mass on a spring: x is position, y is velocity. Damping c makes the swings die away.", params: [{ key: "w", label: "ω", value: 1, min: 0.2, max: 3 }, { key: "c", label: "damping c", value: 0.2, min: 0, max: 2 }], build: p => ({ f: "y", g: `-${p.w * p.w}*x - ${p.c}*y`, x0: 3, y0: 0, window: 5 }) },
  { id: "pendulum", name: "Pendulum", system: true, meaning: "x is the angle, y the angular speed. Small swings look like a spring; big pushes swing it over the top.", params: [{ key: "g", label: "g/L", value: 1, min: 0.2, max: 3 }, { key: "c", label: "damping c", value: 0, min: 0, max: 1 }], build: p => ({ f: "y", g: `-${p.g}*sin(x) - ${p.c}*y`, x0: 2, y0: 0, window: 5 }) },
];
