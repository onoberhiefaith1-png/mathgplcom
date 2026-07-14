// Pure geometry helpers for living diagrams. All units are SVG user units
// against the 0 0 200 140 viewBox we standardised on in visualDispatch.

export type Point = { x: number; y: number };
export type Nodes = Record<string, Point>;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const dist = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const mid = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

// Angle ABC in degrees (angle at vertex b, between rays b→a and b→c).
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return 0;
  const cos = clamp(dot / m, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

// Polar → cartesian around a centre; angle in degrees (0° = east, +CCW).
export function polar(c: Point, r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: c.x + r * Math.cos(rad), y: c.y - r * Math.sin(rad) };
}

// Signed angle of vector p relative to origin c in degrees (−180..180, 0°=east, +CCW).
export function bearing(c: Point, p: Point): number {
  return (Math.atan2(-(p.y - c.y), p.x - c.x) * 180) / Math.PI;
}

// Clamp a point into the axis-aligned box [lo,hi] on both axes.
export function clampBox(p: Point, lo: Point, hi: Point): Point {
  return { x: clamp(p.x, lo.x, hi.x), y: clamp(p.y, lo.y, hi.y) };
}

// Clamp a point to lie within (or on) a circle centred at c with radius r.
export function clampToCircle(p: Point, c: Point, r: number): Point {
  const d = dist(p, c);
  if (d <= r) return p;
  const k = r / d;
  return { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
}

// Project a point onto the line through a and b (returns point on that line).
export function projectOnLine(p: Point, a: Point, b: Point): Point {
  const ax = b.x - a.x, ay = b.y - a.y;
  const len2 = ax * ax + ay * ay;
  if (len2 === 0) return { ...a };
  const t = ((p.x - a.x) * ax + (p.y - a.y) * ay) / len2;
  return { x: a.x + t * ax, y: a.y + t * ay };
}

// Format a pixel-space distance as a friendly length (rounded, no unit).
export function formatLen(px: number): string {
  return (px / 10).toFixed(1);
}

export function formatDeg(deg: number): string {
  return `${Math.round(deg)}°`;
}
