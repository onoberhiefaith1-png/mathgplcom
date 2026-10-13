// Math Lab interpreter — Stage 13. Recognises what the student typed and
// decides which engine/view handles it. Pure, on-device, no AI.
import { parseEquation, type Fn } from "./math";
import { matchConcept } from "./concepts";
import { parseSolid, type Solid } from "./solids";

export type Interpretation =
  | { kind: "solid"; solid: Solid }
  | { kind: "plot"; src: string }
  | { kind: "system"; srcs: string[] }
  | { kind: "matrix"; matrix: number[][] }
  | { kind: "ode"; src: string }
  | { kind: "hypercube"; n: number }
  | { kind: "tool"; tool: string; label: string }
  | { kind: "concept"; id: string }
  | { kind: "error"; message: string };

/** Words that name a tool rather than an equation. */
const TOOL_WORDS: Array<[RegExp, string, string]> = [
  [/eigen|matri|determinant|inverse/i, "matrices", "Matrices"],
  [/deriv|integra|tangent|riemann|area under/i, "calculus", "Calculus"],
  [/differential|direction field|logistic|predator|cooling/i, "ode", "Differential equations"],
  [/sequence|series|taylor|limit|epsilon|continuity/i, "analysis", "Analysis"],
  [/complex|argand|roots of unity/i, "complex", "Complex"],
  [/binomial|poisson|normal distribution|probability/i, "probability", "Probability"],
  [/regression|statistic|mean|scatter/i, "stats", "Statistics"],
  [/newton|bisection|numerical/i, "numerical", "Numerical"],
  [/reflect|rotat|enlarge|translat|conic|ellipse|hyperbola/i, "geometry", "Geometry"],
  [/plane|intersection of planes|cross.?section/i, "space", "3D tools"],
];

/** "[1 2; 3 4]" or "[[1,2],[3,4]]" → square 2×2 / 3×3 matrix. */
export function parseMatrix(src: string): number[][] | null {
  const s = src.trim();
  if (!/^\[.*\]$/.test(s)) return null;
  const rows = s.replace(/^\[\s*\[?|\]?\s*\]$/g, "").split(/\]\s*,\s*\[|;/).map(r =>
    r.trim().split(/[\s,]+/).filter(Boolean).map(Number));
  const n = rows.length;
  if (![2, 3].includes(n) || rows.some(r => r.length !== n || r.some(v => !Number.isFinite(v)))) return null;
  return rows;
}

export function interpret(input: string): Interpretation {
  const s = input.trim();
  if (!s) return { kind: "error", message: "Type an equation, a matrix or a topic." };
  try { const solid = parseSolid(s); if (solid) return { kind: "solid", solid }; }
  catch (error) { return { kind: "error", message: error instanceof Error ? error.message : "Check the solid dimensions." }; }
  const cube = s.match(/^(?:ncube:\s*)?([4-6])D?(?:\s+(?:hypercube|geometry))?$/i);
  if (cube) return { kind: "hypercube", n: Number(cube[1]) };
  const m = parseMatrix(s);
  if (m) return { kind: "matrix", matrix: m };
  if (/^(dy\/dx|y')\s*=/i.test(s)) return { kind: "ode", src: s };
  // Several equations separated by commas/semicolons/new lines (not parametric).
  if (!/\bt\b/.test(s)) {
    const parts = s.split(/\s*[;\n]\s*|,\s*(?=[^)]*(?:\(|$))(?![^(]*\))/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every(p => p.includes("="))) return { kind: "system", srcs: parts };
  }
  const eq = parseEquation(s);
  if (eq.kind !== "error") return { kind: "plot", src: s };
  if (/^[a-z0-9\s'-]+$/i.test(s)) {
    // Stage 15: a named concept with its own guided entry wins over a plain tool word.
    const concept = matchConcept(s);
    if (concept) return { kind: "concept", id: concept.id };
    const hit = TOOL_WORDS.find(([re]) => re.test(s));
    if (hit) return { kind: "tool", tool: hit[1], label: hit[2] };
    return { kind: "error", message: `Math Lab doesn't know the topic "${s}" yet. Try an equation such as y = x^2.` };
  }
  return { kind: "error", message: eq.message };
}

// ---------- Key features of y = f(x), computed (not looked up) ----------

export interface CurveFeatures {
  roots: number[];
  yIntercept: number | null;
  turning: Array<{ x: number; y: number; type: "minimum" | "maximum" }>;
  axisOfSymmetry: number | null;
  table: Array<{ x: number; y: number | null }>;
}

const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Math.round(v * 1e6) / 1e6);

function bisect(g: (x: number) => number, a: number, b: number): number {
  let ga = g(a);
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2, gm = g(m);
    if (ga * gm <= 0) b = m; else { a = m; ga = gm; }
  }
  return (a + b) / 2;
}

export function curveFeatures(f: Fn, lo = -10, hi = 10, steps = 2000): CurveFeatures {
  const F = (x: number) => f({ x });
  const h = (hi - lo) / steps;
  const roots: number[] = [];
  const turning: CurveFeatures["turning"] = [];
  const d = (x: number) => (F(x + 1e-5) - F(x - 1e-5)) / 2e-5;
  for (let i = 0; i < steps; i++) {
    const a = lo + i * h, b = a + h, fa = F(a), fb = F(b);
    if (Number.isFinite(fa) && Number.isFinite(fb)) {
      if (fa === 0) roots.push(a);
      else if (fa * fb < 0 && Math.abs(fa - fb) < 1e3) roots.push(bisect(F, a, b));
      const da = d(a), db = d(b);
      if (Number.isFinite(da) && Number.isFinite(db) && da !== 0 && da * db <= 0) {
        const x = bisect(d, a, b), y = F(x);
        if (Number.isFinite(y) && !turning.some(t => Math.abs(t.x - x) < 1e-6)) turning.push({ x: clean(x), y: clean(y), type: da < 0 ? "minimum" : "maximum" });
      }
    }
  }
  const uniq = [...new Set(roots.map(clean))].filter((r, i, arr) => i === 0 || Math.abs(r - arr[i - 1]) > 1e-6);
  const y0 = F(0);
  let axis: number | null = null;
  if (turning.length === 1) {
    const t = turning[0].x, ok = [1, 2, 3.5].every(k => Math.abs(F(t + k) - F(t - k)) < 1e-6 * Math.max(1, Math.abs(F(t + k))));
    if (ok) axis = t;
  }
  const table = [-3, -2, -1, 0, 1, 2, 3].map(x => { const y = F(x); return { x, y: Number.isFinite(y) ? clean(y) : null }; });
  return { roots: uniq, yIntercept: Number.isFinite(y0) ? clean(y0) : null, turning, axisOfSymmetry: axis, table };
}

/** Intersection of two lines a1x+b1y=c1 written as y=… curves, via features of f−g. */
export function intersections(f: Fn, g: Fn, lo = -10, hi = 10) {
  const diff: Fn = (sc) => f(sc) - g(sc);
  return curveFeatures(diff, lo, hi).roots.map(x => ({ x, y: clean(f({ x })) }));
}
