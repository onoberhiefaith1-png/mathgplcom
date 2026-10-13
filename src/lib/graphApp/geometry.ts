// Transformations and conics for Math Lab — pure.
export type P = [number, number];
export type Transform =
  | { kind: "rotate"; deg: number; cx: number; cy: number }
  | { kind: "reflect"; line: "x-axis" | "y-axis" | "y=x" | "y=-x" }
  | { kind: "enlarge"; k: number; cx: number; cy: number }
  | { kind: "translate"; dx: number; dy: number };

const tidy = (n: number) => Math.abs(n) < 1e-12 ? 0 : Math.round(n * 1e10) / 1e10;

export function applyTransform(pts: P[], t: Transform): P[] {
  return pts.map(([x, y]) => {
    let r: P;
    if (t.kind === "rotate") {
      const a = t.deg * Math.PI / 180, dx = x - t.cx, dy = y - t.cy;
      r = [t.cx + dx * Math.cos(a) - dy * Math.sin(a), t.cy + dx * Math.sin(a) + dy * Math.cos(a)];
    } else if (t.kind === "reflect") {
      r = t.line === "x-axis" ? [x, -y] : t.line === "y-axis" ? [-x, y] : t.line === "y=x" ? [y, x] : [-y, -x];
    } else if (t.kind === "enlarge") r = [t.cx + t.k * (x - t.cx), t.cy + t.k * (y - t.cy)];
    else r = [x + t.dx, y + t.dy];
    return [tidy(r[0]), tidy(r[1])];
  });
}

export type ConicKind = "circle" | "ellipse" | "parabola" | "hyperbola";
export interface Conic { equation: string; definition: string; foci: P[]; directrix?: string; plot: string[] }

/** Conic from its parameters, with foci and the defining property. a, b > 0. */
export function conic(kind: ConicKind, a: number, b: number): Conic {
  if (!(a > 0) || (kind !== "circle" && kind !== "parabola" && !(b > 0))) throw Error("Use positive values.");
  if (kind === "circle") return { equation: `x² + y² = ${a * a}`, definition: `Every point is ${a} from the centre (0, 0).`, foci: [[0, 0]], plot: [`x^2 + y^2 = ${a * a}`] };
  if (kind === "parabola") return { equation: `y² = ${4 * a}x`, definition: `Every point is the same distance from the focus (${a}, 0) as from the directrix x = −${a}.`, foci: [[a, 0]], directrix: `x = ${-a}`, plot: [`y^2 = ${4 * a} x`, `x = ${-a} + 0y`] };
  if (kind === "ellipse") {
    const c = Math.sqrt(Math.abs(a * a - b * b)), horiz = a >= b;
    return { equation: `x²/${a * a} + y²/${b * b} = 1`, definition: `The distances to the two foci always add to ${2 * Math.max(a, b)}.`, foci: horiz ? [[c, 0], [-c, 0]] : [[0, c], [0, -c]], plot: [`x^2/${a * a} + y^2/${b * b} = 1`] };
  }
  const c = Math.sqrt(a * a + b * b);
  return { equation: `x²/${a * a} − y²/${b * b} = 1`, definition: `The difference of the distances to the two foci is always ${2 * a}.`, foci: [[c, 0], [-c, 0]], plot: [`x^2/${a * a} - y^2/${b * b} = 1`, `y = ${b / a}x`, `y = ${-b / a}x`] };
}

/** Distance helper used to check the locus definition. */
export const dist = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]);
