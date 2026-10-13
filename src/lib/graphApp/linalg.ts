// Math Lab linear algebra — pure, on-device, no AI. Separate from the Smartboard.
import { eigs, lusolve, det, multiply } from "mathjs";
import { validMatrix, type Matrix } from "./operations";

export const fmt = (n: number) => { const r = Math.round(n * 1e9) / 1e9; return Object.is(r, -0) ? "0" : String(r); };

export interface Eigen { value: number; vector: number[] }
export interface EigenResult { real: Eigen[]; complex: boolean; steps: string[] }

const unit = (v: number[]) => { const m = Math.hypot(...v) || 1; const s = v.find(x => Math.abs(x) > 1e-9) ?? 1; return v.map(x => (x / m) * Math.sign(s)); };

/** Eigenvalues/eigenvectors. 2×2 shows the characteristic-equation steps. */
export function eigen(a: Matrix): EigenResult {
  if (!validMatrix(a)) throw Error("Enter a finite 2×2 or 3×3 matrix.");
  const steps: string[] = [];
  if (a.length === 2) {
    const [[p, q], [r, s]] = a, tr = p + s, d = p * s - q * r, disc = tr * tr - 4 * d;
    steps.push(`det(A − λI) = (${fmt(p)} − λ)(${fmt(s)} − λ) − (${fmt(q)})(${fmt(r)})`);
    steps.push(`λ² − ${fmt(tr)}λ + ${fmt(d)} = 0`);
    steps.push(`Discriminant = ${fmt(tr)}² − 4(${fmt(d)}) = ${fmt(disc)}`);
    if (disc < -1e-12) { steps.push("Negative discriminant: no real eigenvalues — every direction turns (e.g. a rotation)."); return { real: [], complex: true, steps }; }
    const root = Math.sqrt(Math.max(0, disc));
    const values = Math.abs(root) < 1e-12 ? [tr / 2] : [(tr + root) / 2, (tr - root) / 2];
    const real = values.map(l => {
      let v: number[];
      if (Math.abs(q) > 1e-12) v = [q, l - p];
      else if (Math.abs(r) > 1e-12) v = [l - s, r];
      else v = Math.abs(p - l) < 1e-12 ? [1, 0] : [0, 1];
      return { value: l, vector: unit(v) };
    });
    if (values.length === 1 && Math.abs(q) < 1e-12 && Math.abs(r) < 1e-12) real.push({ value: values[0], vector: [0, 1] });
    steps.push(`λ = (${fmt(tr)} ± √${fmt(disc)}) / 2 → ${values.map(fmt).join(", ")}`);
    return { real, complex: false, steps };
  }
  const res = eigs(a) as unknown as { eigenvectors: { value: unknown; vector: unknown }[] };
  const real: Eigen[] = []; let complex = false;
  for (const e of res.eigenvectors) {
    if (typeof e.value !== "number") { complex = true; continue; }
    const vec = (Array.isArray(e.vector) ? e.vector : (e.vector as { toArray(): unknown[] }).toArray()) as unknown[];
    if (vec.some(x => typeof x !== "number")) { complex = true; continue; }
    real.push({ value: e.value, vector: unit(vec as number[]) });
  }
  steps.push("Solved det(A − λI) = 0 numerically for the 3×3 matrix.");
  if (complex) steps.push("Some eigenvalues are complex: those directions rotate.");
  return { real, complex, steps };
}

/** A × B with each entry written as row · column. */
export function multiplySteps(a: Matrix, b: Matrix): { result: Matrix; steps: string[] } {
  if (!validMatrix(a) || !validMatrix(b) || a.length !== b.length) throw Error("A and B must have the same dimensions.");
  const result = multiply(a, b) as Matrix;
  const steps = result.flatMap((row, i) => row.map((v, j) =>
    `(${i + 1},${j + 1}): ${a[i].map((x, k) => `${fmt(x)}×${fmt(b[k][j])}`).join(" + ")} = ${fmt(v)}`));
  return { result, steps };
}

/** Solve A x = b; rejects singular systems. */
export function solveSystem(a: Matrix, b: number[]): number[] {
  if (!validMatrix(a) || b.length !== a.length || !b.every(Number.isFinite)) throw Error("Enter a finite right-hand side for every row.");
  if (Math.abs(det(a)) < 1e-12) throw Error("det(A) = 0: the system has no unique solution.");
  return (lusolve(a, b) as number[][]).map(r => r[0]);
}

export const PRESETS: { label: string; m: Matrix }[] = [
  { label: "Scale ×2", m: [[2, 0], [0, 2]] },
  { label: "Rotate 90°", m: [[0, -1], [1, 0]] },
  { label: "Reflect in y = x", m: [[0, 1], [1, 0]] },
  { label: "Shear", m: [[1, 1], [0, 1]] },
  { label: "Project onto x-axis", m: [[1, 0], [0, 0]] },
];
