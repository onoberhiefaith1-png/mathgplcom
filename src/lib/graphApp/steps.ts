// Math Lab step writers — Stage 14. Pure, on-device, no AI.
// Every step is computed from the engine's own numbers, never looked up.
import { makeLinearFn } from "./math";
import type { Fn } from "./math";

const n = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6;
  return String(Object.is(r, -0) ? 0 : r).replace("-", "−");
};
const signed = (v: number, term: string) => (v === 0 ? "" : `${v > 0 ? " + " : " − "}${n(Math.abs(v))}${term}`);
/** Coefficient with classroom shorthand: 1x → x, −1y → −y. */
const coef = (v: number, term: string) => (v === 1 ? term : v === -1 ? `−${term}` : `${n(v)}${term}`);
const signedCoef = (v: number, term: string) => (v === 0 ? "" : `${v > 0 ? " + " : " − "}${Math.abs(v) === 1 ? term : `${n(Math.abs(v))}${term}`}`);

/** Extract a·x + b·y = c from an equation f(x,y)=0, or null when not linear in x,y. */
export function linearCoeffs(f: Fn): { a: number; b: number; c: number } | null {
  const f00 = f({ x: 0, y: 0 });
  const a = f({ x: 1, y: 0 }) - f00;
  const b = f({ x: 0, y: 1 }) - f00;
  const c = -f00;
  if (![a, b, c].every(Number.isFinite)) return null;
  // Linearity check at a fresh point: f(2,3) must equal 2a + 3b − c.
  if (Math.abs(f({ x: 2, y: 3 }) - (2 * a + 3 * b - c)) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c))) return null;
  if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return null;
  return { a, b, c };
}

const lineEq = ({ a, b, c }: { a: number; b: number; c: number }) =>
  `${coef(a, "x")}${signedCoef(b, "y")} = ${n(c)}`;

export interface SystemSolution {
  kind: "point" | "parallel" | "coincident";
  x?: number;
  y?: number;
  steps: string[];
  exploreQuestion: string;
}

/** Step-by-step solution of two linear equations a₁x+b₁y=c₁, a₂x+b₂y=c₂. */
export function systemSteps(
  l1: { a: number; b: number; c: number },
  l2: { a: number; b: number; c: number },
): SystemSolution {
  const { a: a1, b: b1, c: c1 } = l1;
  const { a: a2, b: b2, c: c2 } = l2;
  const det = a1 * b2 - a2 * b1;
  const steps: string[] = [
    `Write both equations in the form ax + by = c:`,
    `① ${lineEq(l1)}`,
    `② ${lineEq(l2)}`,
  ];
  if (Math.abs(det) < 1e-9) {
    const scale = Math.abs(a1) > 1e-12 ? a2 / a1 : b2 / b1;
    if (Math.abs(c2 - scale * c1) < 1e-9 * Math.max(1, Math.abs(c2))) {
      steps.push(`Multiply ① by ${n(scale)}: every coefficient matches ②.`, `The two equations are the same line.`, `There are infinitely many solutions — every point on the line works.`);
      return { kind: "coincident", steps, exploreQuestion: "What happens when two equations describe the very same line?" };
    }
    steps.push(`The left sides are in the same ratio (${n(a1)}:${n(b1)} = ${n(a2)}:${n(b2)}) but the right sides are not.`, `The lines are parallel — they never meet.`, `There is no solution.`);
    return { kind: "parallel", steps, exploreQuestion: "What does it mean when two lines never meet?" };
  }
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  // Elimination narrative using the actual numbers.
  steps.push(
    `Multiply ① by ${n(b2)} and ② by ${n(b1)} so the y-coefficients match:`,
    `① ${n(a1 * b2)}x${signed(b1 * b2, "y")} = ${n(c1 * b2)}`,
    `② ${n(a2 * b1)}x${signed(b2 * b1, "y")} = ${n(c2 * b1)}`,
    `Subtract: (${n(a1 * b2)} − ${n(a2 * b1)})x = ${n(c1 * b2)} − ${n(c2 * b1)}`,
    `${n(det)}x = ${n(c1 * b2 - c2 * b1)}`,
    `x = ${n(x)}`,
    `Substitute x = ${n(x)} into ①: ${n(a1)}(${n(x)})${signed(b1, "y")} = ${n(c1)}`,
    `${n(b1)}y = ${n(c1 - a1 * x)}`,
    `y = ${n(y)}`,
    `Check in ②: ${n(a2)}(${n(x)})${signed(b2, `(${n(y)})`)} = ${n(a2 * x + b2 * y)} ✓`,
    `The lines meet at (${n(x)}, ${n(y)}).`,
  );
  return { kind: "point", x, y, steps, exploreQuestion: "What does it mean when two lines meet at one point?" };
}

/** Detect a 2×2 linear system from two parsed implicit equations. */
export function asLinearSystem(f1: Fn, f2: Fn): SystemSolution | null {
  const l1 = linearCoeffs(f1);
  const l2 = linearCoeffs(f2);
  if (!l1 || !l2) return null;
  return systemSteps(l1, l2);
}

export interface QuadraticSolution {
  a: number;
  h: number;
  k: number;
  steps: string[];
  exploreQuestion: string;
  src: string;
}

/** Step-by-step for vertex form y = a(x − h)² + k. */
export function quadraticSteps(a: number, h: number, k: number): QuadraticSolution {
  const A = a, B = -2 * a * h, C = a * h * h + k;
  const disc = B * B - 4 * A * C;
  const steps: string[] = [
    `Start from the vertex form: y = ${coef(a, "")}(x − ${n(h)})²${signed(k, "")}`,
    `The vertex is (${n(h)}, ${n(k)}) — the graph ${a > 0 ? "opens upward, so this is a minimum" : "opens downward, so this is a maximum"}.`,
    `The axis of symmetry is x = ${n(h)}.`,
    `Expand: (x − ${n(h)})² = x² − ${n(2 * h)}x + ${n(h * h)}`,
    `y = ${coef(A, "x²")}${signedCoef(B, "x")}${signed(C, "")}`,
    `Discriminant: b² − 4ac = (${n(B)})² − 4(${n(A)})(${n(C)}) = ${n(disc)}`,
  ];
  if (disc > 1e-9) {
    const r1 = (-B - Math.sqrt(disc)) / (2 * A);
    const r2 = (-B + Math.sqrt(disc)) / (2 * A);
    steps.push(`The discriminant is positive, so there are two roots.`, `x = (${n(-B)} ± √${n(disc)}) / ${n(2 * A)}`, `x = ${n(r1)} or x = ${n(r2)}`);
  } else if (Math.abs(disc) <= 1e-9) {
    steps.push(`The discriminant is zero, so the curve just touches the x-axis.`, `x = ${n(-B / (2 * A))} (a repeated root)`);
  } else {
    steps.push(`The discriminant is negative, so the curve never crosses the x-axis — no real roots.`);
  }
  steps.push(`The y-intercept is (0, ${n(C)}).`);
  const src = `y = ${n(a)} * (x - (${n(h)}))^2 + (${n(k)})`;
  return { a, h, k, steps, exploreQuestion: "How does each of a, h and k move the parabola?", src };
}

/** Recognise y = a(x − h)² + k (or plain y = ax²) from a parsed curve, else null. */
export function asVertexForm(f: Fn): { a: number; h: number; k: number } | null {
  const y0 = f({ x: 0 }), y1 = f({ x: 1 }), y2 = f({ x: 2 });
  if (![y0, y1, y2].every(Number.isFinite)) return null;
  const a = (y2 - 2 * y1 + y0) / 2;
  if (Math.abs(a) < 1e-12) return null;
  const b = y1 - y0 - a;
  const c = y0;
  // Confirm it is exactly quadratic at a fresh point.
  if (Math.abs(f({ x: 3 }) - (9 * a + 3 * b + c)) > 1e-6 * Math.max(1, Math.abs(y2))) return null;
  const h = -b / (2 * a);
  const k = c - a * h * h;
  return { a, h, k };
}

/** Build the f(x,y)=0 function for one equation source (implicit form). */
export function equationFn(src: string): Fn | null {
  return makeLinearFn(src);
}
