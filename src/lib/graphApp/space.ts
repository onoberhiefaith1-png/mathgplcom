// Math Lab Stage 5 — 3D planes, intersections and cross-sections. Pure, on-device.
import type { Fn, ParsedEquation } from "./math";

/** Plane n·(x, y, z) = d. */
export interface Plane { n: [number, number, number]; d: number }
const EPS = 1e-9;
const fmt = (v: number) => (Math.abs(v) < 1e-10 ? "0" : Number(v.toPrecision(8)).toString());

/** Recognise a linear implicit 3D equation (e.g. 2x + y − z = 4) as a plane. */
export function planeOf(eq: ParsedEquation): Plane | null {
  if (eq.kind !== "implicit3d" && eq.kind !== "surface" && eq.kind !== "implicit2d") return null;
  const g: Fn = eq.kind === "surface" ? (s) => eq.f(s) - s.z : eq.f;
  const at = (x: number, y: number, z: number) => g({ x, y, z });
  const c0 = at(0, 0, 0);
  const n: [number, number, number] = [at(1, 0, 0) - c0, at(0, 1, 0) - c0, at(0, 0, 1) - c0];
  if (![c0, ...n].every(Number.isFinite) || n.every((v) => Math.abs(v) < EPS)) return null;
  for (const [x, y, z] of [[2.3, -1.7, 0.9], [-3.1, 4.2, -2.6], [0.5, 0.25, 3.75]]) {
    const want = n[0] * x + n[1] * y + n[2] * z + c0;
    if (Math.abs(at(x, y, z) - want) > 1e-7 * Math.max(1, Math.abs(want))) return null;
  }
  return { n, d: -c0 };
}

const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const det3 = (m: number[][]) => dot(m[0], cross(m[1], m[2]));

export type PlaneMeeting =
  | { kind: "line"; point: [number, number, number]; dir: [number, number, number] }
  | { kind: "parallel" } | { kind: "same" };

export function intersectPlanes(p: Plane, q: Plane): PlaneMeeting {
  const dir = cross(p.n, q.n);
  if (dot(dir, dir) < EPS) {
    // Parallel normals: same plane if one is a multiple of the other including d.
    const k = Math.abs(p.n[0]) > EPS ? q.n[0] / p.n[0] : Math.abs(p.n[1]) > EPS ? q.n[1] / p.n[1] : q.n[2] / p.n[2];
    return Math.abs(q.d - k * p.d) < 1e-9 * Math.max(1, Math.abs(q.d)) ? { kind: "same" } : { kind: "parallel" };
  }
  // Point on both planes closest to the origin.
  const a = cross(q.n, dir).map((v) => v * p.d), b = cross(dir, p.n).map((v) => v * q.d);
  const s = dot(dir, dir);
  const point = [0, 1, 2].map((i) => (a[i] + b[i]) / s) as [number, number, number];
  return { kind: "line", point, dir };
}

export type ThreePlanes =
  | { kind: "point"; point: [number, number, number] }
  | { kind: "none" } | { kind: "infinite" };

/** Solve the 3×3 system by Cramer's rule; classify none / infinitely many by rank. */
export function solveThree(planes: [Plane, Plane, Plane]): ThreePlanes {
  const m = planes.map((p) => p.n);
  const D = det3(m);
  const scale = Math.max(1, ...m.flat().map(Math.abs)) ** 3;
  if (Math.abs(D) > 1e-10 * scale) {
    const rhs = planes.map((p) => p.d);
    const col = (i: number) => m.map((row, r) => row.map((v, c) => (c === i ? rhs[r] : v)));
    return { kind: "point", point: [0, 1, 2].map((i) => det3(col(i)) / D) as [number, number, number] };
  }
  const rank = (rows: number[][]) => {
    const a = rows.map((r) => [...r]); let rk = 0;
    for (let c = 0; c < a[0].length && rk < a.length; c++) {
      let piv = rk; for (let r = rk; r < a.length; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
      if (Math.abs(a[piv][c]) < 1e-9) continue;
      [a[rk], a[piv]] = [a[piv], a[rk]];
      for (let r = 0; r < a.length; r++) if (r !== rk) { const k = a[r][c] / a[rk][c]; a[r] = a[r].map((v, j) => v - k * a[rk][j]); }
      rk++;
    }
    return rk;
  };
  const aug = planes.map((p) => [...p.n, p.d]);
  return rank(aug) > rank(m) ? { kind: "none" } : { kind: "infinite" };
}

export function planeText(p: Plane): string {
  const names = ["x", "y", "z"]; const terms = p.n.map((c, i) => (Math.abs(c) < EPS ? "" : `${c < 0 ? "−" : "+"} ${Math.abs(c) === 1 ? "" : fmt(Math.abs(c))}${names[i]}`)).filter(Boolean);
  return `${terms.join(" ").replace(/^\+ /, "").replace(/^− /, "−")} = ${fmt(p.d)}`;
}

export function lineEquation(m: Extract<PlaneMeeting, { kind: "line" }>): string {
  const [px, py, pz] = m.point, len = Math.hypot(...m.dir), [dx, dy, dz] = m.dir.map((v) => v / len);
  return `x = ${px} + ${dx} * t; y = ${py} + ${dy} * t; z = ${pz} + ${dz} * t`;
}

export function describeLine(m: Extract<PlaneMeeting, { kind: "line" }>): string {
  const p = m.point.map(fmt).join(", "), d = m.dir.map(fmt).join(", ");
  return `r = (${p}) + t(${d})`;
}

/** Marching-squares contour of z = f(x, y) at height h, as 3D segments. */
export function crossSection(f: Fn, h: number, range = 5, n = 60): [number, number, number][][] {
  const step = (2 * range) / n, segs: [number, number, number][][] = [];
  const v = (i: number, j: number) => f({ x: -range + i * step, y: -range + j * step }) - h;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const c = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)];
    if (!c.every(Number.isFinite)) continue;
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    const pts: [number, number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4];
      if ((a < 0) !== (b < 0)) {
        const t = a / (a - b), [ai, aj] = corners[k], [bi, bj] = corners[(k + 1) % 4];
        pts.push([-range + (ai + t * (bi - ai)) * step, -range + (aj + t * (bj - aj)) * step, h]);
      }
    }
    if (pts.length >= 2) segs.push([pts[0], pts[1]]);
    if (pts.length === 4) segs.push([pts[2], pts[3]]);
  }
  return segs;
}
