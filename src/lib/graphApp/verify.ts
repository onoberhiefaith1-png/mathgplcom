// Math Lab Stage 18 — verification and honesty layer. Every claim shown on a
// drawing is re-checked against the equation itself; anything that cannot be
// confirmed is reported plainly instead of being presented as fact. Pure.
import type { Fn } from "./math";
import type { CurveFeatures } from "./interpret";

export interface Check { label: string; ok: boolean; detail: string }
export interface Verification { ok: boolean; checks: Check[]; warnings: string[] }

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Re-check computed curve features against y = f(x). */
export function verifyCurve(f: Fn, c: CurveFeatures, lo = -10, hi = 10): Verification {
  const F = (x: number) => f({ x });
  const checks: Check[] = [];
  for (const r of c.roots) {
    const y = F(r);
    checks.push({ label: `x = ${fmt(r)} is a root`, ok: Number.isFinite(y) && Math.abs(y) < 1e-6, detail: `f(${fmt(r)}) = ${fmt(y)}` });
  }
  for (const t of c.turning) {
    const d = (F(t.x + 1e-4) - F(t.x - 1e-4)) / 2e-4;
    const side = (F(t.x - 0.01) + F(t.x + 0.01)) / 2 - F(t.x);
    const shapeOk = t.type === "minimum" ? side >= -1e-9 : side <= 1e-9;
    checks.push({ label: `(${fmt(t.x)}, ${fmt(t.y)}) is a ${t.type}`, ok: Math.abs(d) < 1e-3 && shapeOk, detail: `gradient ≈ ${fmt(d)}` });
  }
  if (c.yIntercept !== null) {
    checks.push({ label: `y-intercept (0, ${fmt(c.yIntercept)})`, ok: Math.abs(F(0) - c.yIntercept) < 1e-6, detail: `f(0) = ${fmt(F(0))}` });
  }
  return { ok: checks.every(k => k.ok), checks, warnings: domainWarnings(f, lo, hi) };
}

/** Honest notes about where the drawing cannot be trusted. */
export function domainWarnings(f: Fn, lo = -10, hi = 10, steps = 2000): string[] {
  const F = (x: number) => f({ x });
  const h = (hi - lo) / steps;
  let undefinedRuns = 0, inGap = false, jumps = 0, gapStart = 0;
  const gaps: Array<[number, number]> = [];
  let prev = F(lo);
  for (let i = 0; i <= steps; i++) {
    const x = lo + i * h, y = F(x);
    if (!Number.isFinite(y)) { if (!inGap) { inGap = true; gapStart = x; undefinedRuns++; } }
    else {
      if (inGap) { gaps.push([gapStart, x]); inGap = false; }
      if (Number.isFinite(prev) && Math.abs(y - prev) > 1e3 * Math.max(1, h * 100)) jumps++;
    }
    prev = y;
  }
  if (inGap) gaps.push([gapStart, hi]);
  const out: string[] = [];
  if (undefinedRuns) {
    const all = gaps.length === 1 && gaps[0][1] - gaps[0][0] >= hi - lo - h;
    out.push(all ? "The expression is undefined for every x shown, so nothing can be drawn honestly."
      : `Undefined for part of the view (${gaps.slice(0, 3).map(([a, b]) => Math.abs(b - a) < 2 * h ? `near x = ${fmt(a)}` : `${fmt(a)} ≤ x ≤ ${fmt(b)}`).join("; ")}). The curve is left blank there.`);
  }
  if (jumps) out.push("The curve jumps or blows up somewhere in view (likely an asymptote). Lines are not joined across it.");
  return out;
}

/** Sample an implicit curve f(x,y)=0 and confirm the drawn points satisfy it. */
export function verifyImplicit(f: Fn, lo = -10, hi = 10, n = 120): Verification {
  let found = 0, satisfied = 0;
  const h = (hi - lo) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = lo + i * h, y = lo + j * h;
    const a = f({ x, y }), b = f({ x: x + h, y });
    if (!Number.isFinite(a) || !Number.isFinite(b) || a * b > 0 || a === b) continue;
    // Refine along x by bisection, then confirm the point lies on the curve.
    let l = x, r = x + h, fl = a;
    for (let k = 0; k < 50; k++) { const m = (l + r) / 2, fm = f({ x: m, y }); if (fl * fm <= 0) r = m; else { l = m; fl = fm; } }
    found++;
    if (Math.abs(f({ x: (l + r) / 2, y })) < 1e-6 * Math.max(1, Math.abs(a) + Math.abs(b))) satisfied++;
  }
  const checks: Check[] = found
    ? [{ label: `${satisfied} of ${found} sampled points satisfy the equation`, ok: satisfied === found, detail: "each point refined and substituted back" }]
    : [];
  const warnings = found ? [] : ["No points of this curve were found in the current view. It may be empty, a single point, or outside −10…10."];
  return { ok: found > 0 && satisfied === found, checks, warnings };
}
