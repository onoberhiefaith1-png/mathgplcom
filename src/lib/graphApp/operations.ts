import { det, inv, multiply, transpose, derivative } from "mathjs";
import { normalise, parseEquation } from "./math";
export type Matrix = number[][];
export type MatrixOperation = "det" | "inverse" | "transpose" | "multiply" | "add";
export function validMatrix(a: Matrix): boolean {
  return Array.isArray(a) && [2, 3].includes(a.length) && a.every(row => Array.isArray(row) && row.length === a.length && row.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e10));
}
export function matrixOperation(a: Matrix, b: Matrix, op: MatrixOperation): number | Matrix {
  if (!validMatrix(a)) throw Error("Enter a finite 2×2 or 3×3 matrix.");
  if (op === "det") return det(a);
  if (op === "inverse") { if (Math.abs(det(a)) < 1e-12) throw Error("This matrix is singular: it has no inverse."); return inv(a) as Matrix; }
  if (op === "transpose") return transpose(a) as Matrix;
  if (!validMatrix(b) || b.length !== a.length) throw Error("A and B must have the same dimensions.");
  return op === "multiply" ? multiply(a, b) as Matrix : a.map((row, i) => row.map((n, j) => n + b[i][j]));
}
export function transformedSquare(a: Matrix): [number, number][] {
  if (!validMatrix(a) || a.length !== 2) throw Error("The square preview requires a 2×2 matrix.");
  return [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]].map(([x, y]) => [a[0][0] * x + a[0][1] * y, a[1][0] * x + a[1][1] * y]);
}
export function squareEquation(a: Matrix): string {
  transformedSquare(a);
  const x = "min(1, max(0, min(t, 3 - t)))", y = "min(1, max(0, min(t - 1, 4 - t)))";
  return `x = (${a[0][0]}) * (${x}) + (${a[0][1]}) * (${y}); y = (${a[1][0]}) * (${x}) + (${a[1][1]}) * (${y})`;
}
export function curveExpression(src: string): string {
  const eq = parseEquation(src);
  if (eq.kind !== "curve2d") throw Error("Select an explicit curve y = f(x).");
  return normalise(src.includes("=") ? src.slice(src.indexOf("=") + 1) : src).replace(/LOG10\(/g, "log10(");
}
export function differentiate(src: string): string {
  return derivative(curveExpression(src), "x").toString();
}
export function tangent(src: string, x: number): { value: number; slope: number; equation: string } {
  if (!Number.isFinite(x)) throw Error("Enter a finite x-coordinate.");
  const curve = parseEquation(src), d = parseEquation(`y = ${differentiate(src)}`);
  if (curve.kind !== "curve2d" || d.kind !== "curve2d") throw Error("Unable to differentiate this curve.");
  const value = curve.f({ x }), slope = d.f({ x });
  if (!Number.isFinite(value) || !Number.isFinite(slope)) throw Error("The curve or derivative is undefined at this point.");
  // Corner derivatives such as abs(0) must not appear as valid tangent lines.
  const h = 1e-5 * Math.max(1, Math.abs(x));
  const left = (value - curve.f({ x: x - h })) / h, right = (curve.f({ x: x + h }) - value) / h;
  if (!Number.isFinite(left) || !Number.isFinite(right) || Math.abs(left - right) > 0.01 * Math.max(1, Math.abs(left), Math.abs(right))) throw Error("No unique tangent exists at this point.");
  return { value, slope, equation: `y = (${slope}) * (x - (${x})) + (${value})` };
}
export function integrate(src: string, lower: number, upper: number): { value: number; error: number } {
  curveExpression(src);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw Error("Enter finite integration bounds.");
  const curve = parseEquation(src);
  if (curve.kind !== "curve2d") throw Error("Select an explicit curve.");
  const a = Math.min(lower, upper), b = Math.max(lower, upper);
  if (a === b) return { value: 0, error: 0 };
  const f = (x: number) => { const y = curve.f({ x }); if (!Number.isFinite(y)) throw Error("The curve is undefined inside these bounds."); return y; };
  // Preflight interior values avoids silently crossing obvious poles/domain gaps.
  for (let i = 0; i <= 1024; i++) f(a + (b - a) * i / 1024);
  const simpson = (n: number) => {
    let sum = f(a) + f(b);
    for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(a + (b - a) * i / n);
    return sum * (b - a) / (3 * n);
  };
  let previous = simpson(128);
  for (let n = 256; n <= 16384; n *= 2) {
    const value = simpson(n), error = Math.abs(value - previous) / 15;
    if (Number.isFinite(value) && error <= 1e-8 * Math.max(1, Math.abs(value))) return { value: value * (upper < lower ? -1 : 1), error };
    previous = value;
  }
  throw Error("Integration did not converge reliably; choose a continuous interval or narrower bounds.");
}
