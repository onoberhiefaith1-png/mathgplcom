// Geometry helpers + constraint solver for the Universal Line Engine.

import type { ULELine, ULEModel, ULERelation, SnapIncrement } from "./types";

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

export function lineAngleDeg(l: ULELine): number {
  const a = Math.atan2(l.by - l.ay, l.bx - l.ax) * DEG;
  return (a + 360) % 360;
}

export function lineLength(l: ULELine): number {
  return Math.hypot(l.bx - l.ax, l.by - l.ay);
}

export function lineMidpoint(l: ULELine): { x: number; y: number } {
  return { x: (l.ax + l.bx) / 2, y: (l.ay + l.by) / 2 };
}

/** Angle from line1 to line2 (0..360), measured at the shared vertex if any,
 *  otherwise as the difference of their direction angles. */
export function angleBetween(a: ULELine, b: ULELine): number {
  const d = lineAngleDeg(b) - lineAngleDeg(a);
  return ((d % 360) + 360) % 360;
}

/** Set the line's B endpoint so it has `len` and `deg` while keeping A fixed. */
export function setEndpointsFromPolar(l: ULELine, len: number, deg: number): ULELine {
  const r = deg / DEG;
  return { ...l, bx: l.ax + Math.cos(r) * len, by: l.ay + Math.sin(r) * len };
}

/** Rotate line about a pivot point by `deltaDeg` degrees. */
export function rotateAbout(l: ULELine, px: number, py: number, deltaDeg: number): ULELine {
  const r = deltaDeg / DEG;
  const c = Math.cos(r), s = Math.sin(r);
  const rot = (x: number, y: number) => ({
    x: px + (x - px) * c - (y - py) * s,
    y: py + (x - px) * s + (y - py) * c,
  });
  const A = rot(l.ax, l.ay);
  const B = rot(l.bx, l.by);
  return { ...l, ax: A.x, ay: A.y, bx: B.x, by: B.y };
}

/** Snap an angle in degrees to the nearest increment. */
export function snapAngle(deg: number, snap: SnapIncrement): number {
  if (!snap) return deg;
  return Math.round(deg / snap) * snap;
}

/** Find lines that share an endpoint with `line` and return the shared point. */
export function sharedVertex(a: ULELine, b: ULELine, tol = 0.5):
  | { ax: "A" | "B"; bx: "A" | "B"; x: number; y: number } | null {
  const pairs: Array<["A" | "B", number, number, "A" | "B", number, number]> = [
    ["A", a.ax, a.ay, "A", b.ax, b.ay],
    ["A", a.ax, a.ay, "B", b.bx, b.by],
    ["B", a.bx, a.by, "A", b.ax, b.ay],
    ["B", a.bx, a.by, "B", b.bx, b.by],
  ];
  for (const [ax, x1, y1, bx, x2, y2] of pairs) {
    if (Math.hypot(x1 - x2, y1 - y2) < tol) return { ax, bx, x: x1, y: y1 };
  }
  return null;
}

/** Set the angle between two lines. Rotates `b` about the shared vertex
 *  (or its midpoint if no vertex exists) so that angleBetween(a,b) = `deg`. */
export function setAngleBetween(a: ULELine, b: ULELine, deg: number): ULELine {
  const sv = sharedVertex(a, b);
  const px = sv ? sv.x : (b.ax + b.bx) / 2;
  const py = sv ? sv.y : (b.ay + b.by) / 2;
  const current = angleBetween(a, b);
  return rotateAbout(b, px, py, deg - current);
}

/** Apply relation constraints: parallel, perpendicular, equal length. */
export function applyRelations(model: ULEModel, changedId: string): ULEModel {
  const lines = [...model.lines];
  const byId = new Map(lines.map((l) => [l.id, l]));

  const rerun = (rel: ULERelation) => {
    const [ida, idb] = rel.lineIds;
    // The line the user just edited stays; the other line adapts.
    const anchorId = changedId === idb ? idb : ida;
    const followerId = anchorId === ida ? idb : ida;
    const anchor = byId.get(anchorId);
    const follower = byId.get(followerId);
    if (!anchor || !follower) return;
    let next = follower;
    if (rel.kind === "parallel") {
      next = setAngleBetween(anchor, next, 0);
    } else if (rel.kind === "perpendicular") {
      next = setAngleBetween(anchor, next, 90);
    } else if (rel.kind === "equalLength") {
      const targetLen = lineLength(anchor);
      const deg = lineAngleDeg(next);
      next = setEndpointsFromPolar(next, targetLen, deg);
    }
    byId.set(followerId, next);
  };

  // Two passes so chained constraints settle for simple cases.
  for (let pass = 0; pass < 2; pass++) {
    for (const rel of model.relations) rerun(rel);
  }
  return { ...model, lines: Array.from(byId.values()) };
}

/** Return endpoint coord after applying arrowhead offset so caps don't
 *  poke over the endpoint. Kept minimal — 0 for now. */
export function endpointOffset(_cap: string): number { return 0; }

export { TAU, DEG };
