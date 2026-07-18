// Smart-snap: find nearest snappable target within a pixel threshold.

import type { GeometryScene, GeoPoint } from "../scene";
import { pointById } from "../scene";

export interface SnapTarget {
  x: number;
  y: number;
  /** id of an existing point we snapped to (so a new edge can reference it). */
  pointId?: string;
}

export const SNAP_RADIUS = 10;

export function snap(scene: GeometryScene, x: number, y: number, radius = SNAP_RADIUS): SnapTarget {
  let best: SnapTarget = { x, y };
  let bestDist = radius;

  // Snap to existing points
  for (const o of scene.objects) {
    if (o.type === "point" && !o.hidden) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: o.x, y: o.y, pointId: o.id };
      }
    }
  }

  // Snap to segment midpoints
  for (const o of scene.objects) {
    if (o.type === "segment") {
      const a = pointById(scene, o.a);
      const b = pointById(scene, o.b);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const d = Math.hypot(mx - x, my - y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: mx, y: my };
      }
    }
  }

  return best;
}

/** Rich hit kind. */
export type HitKind =
  | "point"
  | "pointLabel"
  | "segmentBody"
  | "segmentLabel"
  | "segmentDistance"
  | "circle"
  | "arc"
  | "curve"
  | "polygon"
  | "angle"
  | "label";

export interface Hit { id: string; kind: HitKind }

/** Pick the topmost object at (x,y). Segments split into body/label/distance;
 *  points split into dot/label. */
export function pickHit(scene: GeometryScene, x: number, y: number, hit = 8): Hit | null {
  // 1) Point dot (highest priority)
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type === "point" && !o.hidden && Math.hypot(o.x - x, o.y - y) <= hit) {
      return { id: o.id, kind: "point" };
    }
  }
  // 2) Point label glyph (approx bbox around label anchor)
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type !== "point" || o.hidden || !o.label) continue;
    const dx = o.labelOffset?.dx ?? 6;
    const dy = o.labelOffset?.dy ?? -6;
    const lx = o.x + dx, ly = o.y + dy;
    // label is ~14px tall, ~10px wide per char; use small box
    const w = Math.max(10, o.label.length * 8);
    if (x >= lx - 2 && x <= lx + w && y >= ly - 12 && y <= ly + 4) {
      return { id: o.id, kind: "pointLabel" };
    }
  }
  // 3) Segment label + distance chip
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type !== "segment") continue;
    const a = pointById(scene, o.a); const b = pointById(scene, o.b);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    if (o.label) {
      const off = o.labelOffset;
      const lx = off ? mx + off.dx : mx + nx * 14;
      const ly = off ? my + off.dy : my + ny * 14;
      if (Math.hypot(lx - x, ly - y) <= 12) return { id: o.id, kind: "segmentLabel" };
    }
    const dist = o.distance ?? o.length;
    if (dist) {
      const off = o.distanceOffset;
      const lx = off ? mx + off.dx : mx - nx * 14;
      const ly = off ? my + off.dy : my - ny * 14;
      if (Math.hypot(lx - x, ly - y) <= 14) return { id: o.id, kind: "segmentDistance" };
    }
  }
  // 4) Shapes (segment body last so label wins).
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    switch (o.type) {
      case "segment": {
        const a = pointById(scene, o.a); const b = pointById(scene, o.b);
        if (!a || !b) break;
        if (distPointToSegment({ x, y }, a, b) <= hit) return { id: o.id, kind: "segmentBody" };
        break;
      }
      case "circle": {
        const c = pointById(scene, o.center); if (!c) break;
        if (Math.abs(Math.hypot(c.x - x, c.y - y) - o.r) <= hit) return { id: o.id, kind: "circle" };
        break;
      }
      case "arc": {
        const c = pointById(scene, o.center); if (!c) break;
        if (Math.abs(Math.hypot(c.x - x, c.y - y) - o.r) <= hit) return { id: o.id, kind: "arc" };
        break;
      }
      case "curve": {
        for (let k = 0; k < o.points.length - 1; k++) {
          const a = pointById(scene, o.points[k]);
          const b = pointById(scene, o.points[k + 1]);
          if (a && b && distPointToSegment({ x, y }, a, b) <= hit) return { id: o.id, kind: "curve" };
        }
        break;
      }
      case "polygon": {
        for (let k = 0; k < o.points.length; k++) {
          const a = pointById(scene, o.points[k]);
          const b = pointById(scene, o.points[(k + 1) % o.points.length]);
          if (a && b && distPointToSegment({ x, y }, a, b) <= hit) return { id: o.id, kind: "polygon" };
        }
        break;
      }
      case "angle": {
        const v = pointById(scene, o.vertex); if (!v) break;
        if (Math.hypot(v.x - x, v.y - y) <= 22) return { id: o.id, kind: "angle" };
        break;
      }
      case "label": {
        if (Math.hypot(o.x - x, o.y - y) <= 14) return { id: o.id, kind: "label" };
        break;
      }
    }
  }
  return null;
}

/** Legacy: pick just an id. */
export function pickObject(scene: GeometryScene, x: number, y: number, hit = 8): string | null {
  return pickHit(scene, x, y, hit)?.id ?? null;
}

function distPointToSegment(
  p: { x: number; y: number },
  a: GeoPoint,
  b: GeoPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return Math.hypot(p.x - cx, p.y - cy);
}
