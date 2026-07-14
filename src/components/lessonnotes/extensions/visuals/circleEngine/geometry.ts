// Circle Engine — arc/path math. SVG uses y-down, so we negate the y
// component when converting from the user-facing "0° = east, CCW" model.

import type { UCECircle } from "./types";

const DEG = Math.PI / 180;

/** Point on the rim at the given angle (degrees, 0 = east, CCW positive). */
export function pointOnRim(c: UCECircle, deg: number) {
  const r = deg * DEG;
  return { x: c.cx + Math.cos(r) * c.r, y: c.cy - Math.sin(r) * c.r };
}

export function normSweep(deg: number): number {
  let s = deg % 360;
  if (s < 0) s += 360;
  return s;
}

/** SVG path `d` for the circle's current type. */
export function circlePath(c: UCECircle): string {
  const type = c.type;
  if (type === "circle") {
    const { cx, cy, r } = c;
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
  }
  const sweep = type === "semicircle" ? 180 : type === "quadrant" ? 90 : normSweep(c.sweepDeg);
  const start = c.startDeg;
  const end = start + sweep;
  const p0 = pointOnRim(c, start);
  const p1 = pointOnRim(c, end);
  const large = sweep > 180 ? 1 : 0;
  // SVG sweep-flag: 0 draws CCW-visually in y-down (which matches our CCW model).
  const swf = 0;
  const arc = `A ${c.r} ${c.r} 0 ${large} ${swf} ${p1.x} ${p1.y}`;
  if (type === "arc") return `M ${p0.x} ${p0.y} ${arc}`;
  if (type === "sector" || type === "semicircle" || type === "quadrant") {
    return `M ${c.cx} ${c.cy} L ${p0.x} ${p0.y} ${arc} Z`;
  }
  // segment: chord + arc
  return `M ${p0.x} ${p0.y} ${arc} Z`;
}

/** Angle (deg, 0 = east, CCW positive) from centre to (x,y). */
export function angleFromCentre(c: UCECircle, x: number, y: number): number {
  const a = Math.atan2(-(y - c.cy), x - c.cx) / DEG;
  return a < 0 ? a + 360 : a;
}

export function distance(c: UCECircle, x: number, y: number): number {
  const dx = x - c.cx, dy = y - c.cy;
  return Math.hypot(dx, dy);
}
