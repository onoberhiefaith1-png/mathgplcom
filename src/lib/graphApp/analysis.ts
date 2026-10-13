// Math Lab real analysis — sequences, series, ε–N and ε–δ limits, Taylor
// polynomials. Pure, on-device, no AI. Verdicts are numerical evidence and are
// labelled ≈ where they are estimates, never symbolic proofs.
import { compile, parse } from "mathjs";
import { normalise } from "./math";
import { fmt } from "./linalg";

/** 6 significant digits for coefficient/limit display (fmt keeps 9 for money-like values). */
const fmtG = (v: number) => (Object.is(v, -0) ? "0" : String(Number(v.toPrecision(6))));

const SEQ_ALLOWED = ["n", "e", "pi", "sin", "cos", "tan", "sqrt", "abs", "log", "log10", "exp", "sign", "floor"];

export type SeqFn = (n: number) => number;

/** Compile a formula in n, e.g. "1/2^n", "(-1)^n/n". */
export function sequenceFn(src: string): SeqFn {
  const body = normalise(src.includes("=") ? src.slice(src.indexOf("=") + 1) : src).replace(/LOG10\(/g, "log10(");
  if (!body) throw Error("Enter a formula for the term aₙ.");
  parse(body).traverse(node => {
    if (node.type === "SymbolNode" && !SEQ_ALLOWED.includes(String((node as unknown as { name: string }).name))) throw Error(`Unknown symbol: ${(node as unknown as { name: string }).name} (use n)`);
  });
  const code = compile(body);
  return n => { try { const v = code.evaluate({ n, e: Math.E, pi: Math.PI }); return typeof v === "number" ? v : Number.NaN; } catch { return Number.NaN; } };
}

export function sequenceTerms(f: SeqFn, count: number): number[] {
  const n = Math.round(count);
  if (!(n >= 1 && n <= 500)) throw Error("Show between 1 and 500 terms.");
  const out: number[] = [];
  for (let i = 1; i <= n; i++) out.push(f(i));
  if (!out.some(Number.isFinite)) throw Error("The formula gives no real values.");
  return out;
}

export type SequenceVerdict =
  | { kind: "convergent"; limit: number }
  | { kind: "divergent"; reason: string }
  | { kind: "oscillating"; reason: string };

/** Numerical verdict on where a sequence is heading (evidence, not a proof). */
export function convergesTo(terms: number[]): SequenceVerdict {
  const t = terms.filter(Number.isFinite);
  if (t.length < 6) return { kind: "oscillating", reason: "Not enough real terms to judge — show more terms." };
  const m = Math.max(...t.map(Math.abs));
  if (m > 1e8) return { kind: "divergent", reason: `The terms grow without bound (largest |aₙ| = ${fmt(m)}).` };
  const third = Math.max(1, Math.floor(t.length / 3));
  const midM = Math.max(...t.slice(third, 2 * third).map(Math.abs));
  const endM = Math.max(...t.slice(2 * third).map(Math.abs));
  if (endM > midM * 2 && endM > 1) return { kind: "divergent", reason: "The terms keep growing, so the sequence has no limit." };
  const w = Math.max(4, Math.min(12, Math.floor((t.length - third) / 2)));
  const spread = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
  const spreadA = spread(t.slice(t.length - 2 * w, t.length - w));
  const spreadB = spread(t.slice(t.length - w));
  const limit = t.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, t.length);
  if (spreadB > spreadA * 0.5 && spreadB > 1e-6 * (1 + Math.abs(limit))) return { kind: "oscillating", reason: "The terms keep jumping between values; they never settle (numerical evidence)." };
  return { kind: "convergent", limit };
}

/** Constant ratio test for a geometric sequence a₁, a₁r, a₁r², … */
export function geometricRatio(terms: number[]): { a1: number; r: number } | null {
  const t = terms.filter(Number.isFinite);
  if (t.length < 4) return null;
  let r: number | null = null;
  for (let i = 0; i < t.length - 1; i++) {
    if (Math.abs(t[i]) < 1e-12) return null;
    const q = t[i + 1] / t[i];
    if (r === null) r = q; else if (Math.abs(q - r) > 1e-9 * (1 + Math.abs(q))) return null;
  }
  return r === null ? null : { a1: t[0], r };
}

/** Fit |aₙ| = c·n^(−p) in log space; null when the terms do not follow a power law. */
export function powerLaw(terms: number[]): { c: number; p: number } | null {
  const t = terms.filter(Number.isFinite);
  if (t.length < 10) return null;
  const pts: [number, number][] = [];
  for (let i = 5; i < t.length; i++) if (t[i] > 0) pts.push([Math.log(i + 1), Math.log(t[i])]);
  if (pts.length < 5) return null;
  const n = pts.length;
  const sx = pts.reduce((a, q) => a + q[0], 0), sy = pts.reduce((a, q) => a + q[1], 0);
  const sxx = pts.reduce((a, q) => a + q[0] * q[0], 0), sxy = pts.reduce((a, q) => a + q[0] * q[1], 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  let maxRes = 0;
  for (const [x, y] of pts) maxRes = Math.max(maxRes, Math.abs(y - (intercept + slope * x)));
  if (maxRes > 0.02) return null;
  return { c: Math.exp(intercept), p: -slope };
}

/** Sign alternation with shrinking sizes (Leibniz test, stated numerically). */
export function alternating(terms: number[]): boolean {
  const t = terms.filter(Number.isFinite);
  if (t.length < 6) return false;
  let signs = 0;
  for (let i = 1; i < t.length; i++) if (t[i] * t[i - 1] < 0) signs++;
  if (signs < t.length - 2) return false;
  for (let i = 1; i < t.length; i++) if (Math.abs(t[i]) > Math.abs(t[i - 1]) + 1e-12) return false;
  return true;
}

export interface SeriesRow { n: number; term: number; sum: number }

export interface SeriesReport { rows: SeriesRow[]; verdict: string; exact?: string }

export function seriesReport(f: SeqFn, count: number): SeriesReport {
  const terms = sequenceTerms(f, count);
  const rows: SeriesRow[] = [];
  let s = 0;
  for (let i = 0; i < terms.length; i++) { if (Number.isFinite(terms[i])) s += terms[i]; rows.push({ n: i + 1, term: terms[i], sum: s }); }
  const geo = geometricRatio(terms);
  if (geo && Math.abs(geo.r) < 1) return { rows, exact: `S∞ = a/(1 − r) = ${fmt(geo.a1)}/(1 − (${fmt(geo.r)})) = ${fmt(geo.a1 / (1 - geo.r))}`, verdict: `Geometric with ratio ${fmt(geo.r)}, and |r| < 1, so the series converges.` };
  if (geo) return { rows, verdict: `Geometric with ratio ${fmt(geo.r)}, and |r| ≥ 1, so the series diverges — the sums never settle.` };
  if (alternating(terms)) {
    const next = [...terms].reverse().find(Number.isFinite)!;
    return { rows, verdict: `Alternating with shrinking term sizes, so it converges. The next term bounds the error: the true sum is within ±${fmt(Math.abs(next))} of ${fmt(rows[rows.length - 1].sum)}.` };
  }
  const pw = powerLaw(terms);
  if (pw && pw.p > 1) return {
    rows,
    verdict: `The terms behave like ${fmtG(pw.c)}·n^(−${fmtG(pw.p)}) with p = ${fmtG(pw.p)} > 1 (p-series), so the series converges.`,
    exact: Math.abs(pw.p - 2) < 0.01 && Math.abs(pw.c - 1) < 0.01 ? "The exact sum of Σ1/n² is π²/6 ≈ 1.644934." : undefined,
  };
  if (pw) return { rows, verdict: `The terms behave like 1/n^${fmtG(pw.p)} with p ≤ 1 (p-series), so the series diverges — the harmonic series Σ1/n is the classic example.` };
  const sums = rows.map(r => r.sum);
  const conv = convergesTo(sums);
  if (conv.kind === "convergent") return { rows, verdict: `The partial sums settle toward ≈ ${fmt(conv.limit)}, so the series converges (numerical estimate; no error bound found here).` };
  if (conv.kind === "divergent") return { rows, verdict: `The partial sums keep growing, so the series diverges.` };
  return { rows, verdict: `The partial sums do not settle, so the series does not converge (numerical evidence).` };
}

/** Smallest N with |aₙ − limit| < ε for every n ≥ N; flags say which terms sit inside the band. */
export function epsilonN(terms: number[], limit: number, eps: number): { n: number | null; flags: boolean[] } {
  if (!(eps > 0)) throw Error("Choose a positive ε.");
  const flags = terms.map(t => Number.isFinite(t) && Math.abs(t - limit) < eps);
  let found: number | null = null;
  for (let i = terms.length - 1; i >= 0; i--) { if (!flags[i]) break; found = i + 1; }
  return { n: found, flags };
}

const X_ALLOWED = ["x", "e", "pi", "sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "abs", "log", "log10", "exp", "sign", "floor"];

export type Fn1 = (x: number) => number;

/** Compile a function of x, e.g. "2x + 1", "sin(1/x)". */
export function fnOfX(src: string): Fn1 {
  const body = normalise(src.includes("=") ? src.slice(src.indexOf("=") + 1) : src).replace(/LOG10\(/g, "log10(");
  if (!body) throw Error("Enter a function of x.");
  parse(body).traverse(node => {
    if (node.type === "SymbolNode" && !X_ALLOWED.includes(String((node as unknown as { name: string }).name))) throw Error(`Unknown symbol: ${(node as unknown as { name: string }).name} (use x)`);
  });
  const code = compile(body);
  return x => { try { const v = code.evaluate({ x, e: Math.E, pi: Math.PI }); return typeof v === "number" ? v : Number.NaN; } catch { return Number.NaN; } };
}

export interface LimitResult { limit: number; exists: boolean; reason?: string }

/** Two-sided numerical limit by approaching from both sides. */
export function numericalLimit(f: Fn1, a: number): LimitResult {
  const at = (dir: 1 | -1, h: number) => f(a + dir * h);
  let left = Number.NaN, right = Number.NaN;
  for (const h of [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1]) {
    if (!Number.isFinite(left)) { const v = at(-1, h); if (Number.isFinite(v)) left = v; }
    if (!Number.isFinite(right)) { const v = at(1, h); if (Number.isFinite(v)) right = v; }
    if (Number.isFinite(left) && Number.isFinite(right)) break;
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return { limit: Number.NaN, exists: false, reason: "f is not defined on one side of this point." };
  /** Values must settle as x closes in; growing or wandering values mean no limit. */
  const unstable = (dir: 1 | -1) => {
    const hs = [1e-4, 1e-5, 1e-6, 1e-7];
    const vs = hs.map(h => at(dir, h));
    if (vs.some(v => !Number.isFinite(v)) || vs.some(v => Math.abs(v) > 1e8)) return true;
    const d = [0, 1, 2].map(i => Math.abs(vs[i + 1] - vs[i]));
    return !(d[1] < d[0] * 0.9 && d[2] < d[1] * 0.9) && d[0] > 1e-6 * (1 + Math.abs(vs[3]));
  };
  if (unstable(-1) || unstable(1)) return { limit: Number.NaN, exists: false, reason: "The values keep changing (or growing) as x approaches — for example sin(1/x) or 1/x near 0." };
  if (Math.abs(left - right) > 1e-4 * (1 + Math.abs(left))) return { limit: Number.NaN, exists: false, reason: `The two sides disagree: from the left ≈ ${fmtG(left)}, from the right ≈ ${fmtG(right)} — a jump.` };
  return { limit: (left + right) / 2, exists: true };
}

export interface EpsilonDelta { limit: number; delta: number | null; working: string[] }

/** Find the largest δ (numerically) with 0 < |x − a| < δ ⇒ |f(x) − L| < ε. */
export function epsilonDelta(f: Fn1, a: number, eps: number): EpsilonDelta {
  if (!(eps > 0)) throw Error("Choose a positive ε.");
  const lim = numericalLimit(f, a);
  if (!lim.exists) return { limit: Number.NaN, delta: null, working: ["The limit does not exist at this point.", lim.reason ?? "", "So no δ can make the ε condition hold — this is the counter-example, not a mistake."] };
  const L = lim.limit;
  const bad = (x: number) => { const v = f(x); return !Number.isFinite(v) || Math.abs(v - L) >= eps; };
  const ok = (d: number) => {
    for (let i = 1; i <= 120; i++) {
      const off = (d * i) / 121;
      if (bad(a - off) || bad(a + off)) return false;
    }
    return true;
  };
  let lo = 0, hi = -1;
  if (!ok(0.0005)) return { limit: L, delta: null, working: [`The limit is L ≈ ${fmtG(L)}.`, "Even a tiny δ lets some x escape the ε-band: the function jumps or oscillates at this point."] };
  let d = 0.0005;
  while (d <= 4 && ok(d)) { lo = d; d *= 2; }
  if (d > 4) hi = 4;
  else {
    let a2 = lo, b2 = d;
    for (let k = 0; k < 40; k++) { const m = (a2 + b2) / 2; if (ok(m)) a2 = m; else b2 = m; }
    hi = a2;
  }
  const delta = Math.max(lo, hi);
  return {
    limit: L,
    delta,
    working: [
      `Claim: for this ε = ${fmt(eps)}, every x within δ of ${fmt(a)} keeps |f(x) − L| < ε.`,
      `The limit is L ≈ ${fmtG(L)}.`,
      `Scanning outward (numerically), the largest δ that works is δ ≈ ${fmtG(delta)}.`,
      `So 0 < |x − ${fmt(a)}| < ${fmtG(delta)} guarantees |f(x) − L| < ${fmt(eps)}.`,
    ],
  };
}

export interface ContinuityVerdict { defined: boolean; value?: number; limitExists: boolean; limit?: number; continuous: boolean; reason: string }

export function continuityAt(f: Fn1, a: number): ContinuityVerdict {
  const fa = f(a);
  const defined = Number.isFinite(fa);
  const lim = numericalLimit(f, a);
  if (!defined && !lim.exists) return { defined, limitExists: false, continuous: false, reason: `f(${fmt(a)}) is not defined and the limit does not exist (${lim.reason ?? "a jump or oscillation"}).` };
  if (defined && !lim.exists) return { defined, value: fa, limitExists: false, continuous: false, reason: `f(${fmt(a)}) = ${fmt(fa)} is defined, but the limit does not exist.` };
  if (!defined) return { defined, limitExists: true, limit: lim.limit, continuous: false, reason: `The limit is ≈ ${fmtG(lim.limit)}, but f(${fmt(a)}) is undefined — a hole (removable discontinuity).` };
  if (Math.abs(fa - (lim.limit as number)) > 1e-4 * (1 + Math.abs(lim.limit as number))) return { defined, value: fa, limitExists: true, limit: lim.limit, continuous: false, reason: `f(${fmt(a)}) = ${fmt(fa)} but the limit is ≈ ${fmtG(lim.limit as number)} — they disagree.` };
  return { defined, value: fa, limitExists: true, limit: lim.limit, continuous: true, reason: `f(${fmt(a)}) = ${fmtG(lim.limit as number)} equals the limit, so f is continuous at ${fmt(a)}.` };
}

const binom = (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r; };
const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

export interface TaylorTerm { k: number; derivative: number; coef: number }

/** Taylor coefficients by central differences (degree ≤ 6); numerical, labelled ≈. */
export function taylorCoeffs(f: Fn1, x0: number, degree: number): TaylorTerm[] {
  const deg = Math.round(degree);
  if (!(deg >= 0 && deg <= 6)) throw Error("Use a degree between 0 and 6.");
  const h = 0.01;
  const out: TaylorTerm[] = [];
  for (let k = 0; k <= deg; k++) {
    let sum = 0;
    for (let j = 0; j <= k; j++) {
      const v = f(x0 + (k / 2 - j) * h);
      if (!Number.isFinite(v)) throw Error(`The function is not defined near x = ${fmt(x0)}, so its derivatives there cannot be built.`);
      sum += (j % 2 === 0 ? 1 : -1) * binom(k, j) * v;
    }
    out.push({ k, derivative: sum / h ** k, coef: sum / h ** k / fact(k) });
  }
  return out;
}

/** P(x) = Σ cₖ(x − x₀)ᵏ, evaluated numerically. */
export function taylorValue(coeffs: TaylorTerm[], x0: number, x: number): number {
  let acc = 0;
  for (const { k, coef } of coeffs) acc += coef * (x - x0) ** k;
  return acc;
}

/** Plot-ready expression "y = c₀ + c₁x + …" with ≈-precision coefficients. */
export function taylorExpression(coeffs: TaylorTerm[], x0: number): string {
  const parts: string[] = [];
  for (const { k, coef } of coeffs) {
    if (Math.abs(coef) < 1e-12) continue;
    const c = fmtG(coef);
    const pow = x0 === 0 ? (k === 0 ? "" : k === 1 ? "x" : `x^${k}`) : k === 0 ? "" : `(x - ${fmtG(x0)})${k === 1 ? "" : `^${k}`}`;
    parts.push(`${c}${pow}`);
  }
  return `y = ${parts.length ? parts.join(" + ").replace(/\+ -/g, "- ") : "0"}`;
}

/** Note when the coefficients match a classic series (sin x, cos x, e^x at 0). */
export function classicNote(coeffs: TaylorTerm[], x0: number): string | null {
  if (Math.abs(x0) > 1e-9 || coeffs.length < 4) return null;
  const close = (v: number, target: number) => Math.abs(v - target) < 2e-3;
  const c = coeffs.map(t => t.coef);
  const isExp = c.every((v, k) => close(v, 1 / fact(k)));
  const isSin = c.every((v, k) => close(v, k % 4 === 1 ? 1 / fact(k) : k % 4 === 3 ? -1 / fact(k) : 0));
  const isCos = c.every((v, k) => close(v, k % 4 === 0 ? (k % 8 === 0 ? 1 : -1) / fact(k) : 0));
  if (isExp) return "These match the classic series e^x = 1 + x + x²/2 + x³/6 + … — how calculators actually compute e^x.";
  if (isSin) return "These match the classic series sin x = x − x³/6 + x⁵/120 − … — how calculators actually compute sin x.";
  if (isCos) return "These match the classic series cos x = 1 − x²/2 + x⁴/24 − … — how calculators actually compute cos x.";
  return null;
}

export const COUNTER_EXAMPLES = [
  { id: "jump", label: "A jump at x = 0", src: "sign(x)", a: 0, eps: 0.5, note: "sign(x) steps from −1 to +1 at 0 while still having a value there. The two one-sided limits disagree, so the limit does not exist and no δ can work — continuity disproved at a point where the function is defined." },
  { id: "oscillate", label: "sin(1/x) near 0", src: "sin(1/x)", a: 0, eps: 0.25, note: "As x approaches 0, sin(1/x) swings between −1 and 1 faster and faster without settling. The limit does not exist — the values keep changing however close you get." },
  { id: "steps", label: "floor(x) at a whole number", src: "floor(x)", a: 1, eps: 0.5, note: "floor(x) jumps at every whole number. At x = 1 the left limit is 0 and the right limit is 1, so continuity fails there — but holds everywhere else." },
] as const;
