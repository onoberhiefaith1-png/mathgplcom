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

/** Pick the topmost object at (x,y) within hit-radius. Used by select/erase/label. */
export function pickObject(scene: GeometryScene, x: number, y: number, hit = 8): string | null {
  // Walk in reverse so the most recently added object wins.
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    switch (o.type) {
      case "point": {
        if (o.hidden) break;
        if (Math.hypot(o.x - x, o.y - y) <= hit) return o.id;
        break;
      }
      case "segment": {
        const a = pointById(scene, o.a);
        const b = pointById(scene, o.b);
        if (!a || !b) break;
        if (distPointToSegment({ x, y }, a, b) <= hit) return o.id;
        break;
      }
      case "circle": {
        const c = pointById(scene, o.center);
        if (!c) break;
        const d = Math.abs(Math.hypot(c.x - x, c.y - y) - o.r);
        if (d <= hit) return o.id;
        break;
      }
      case "arc": {
        const c = pointById(scene, o.center);
        if (!c) break;
        const d = Math.abs(Math.hypot(c.x - x, c.y - y) - o.r);
        if (d <= hit) return o.id;
        break;
      }
      case "polygon": {
        // hit-test on edges
        for (let k = 0; k < o.points.length; k++) {
          const a = pointById(scene, o.points[k]);
          const b = pointById(scene, o.points[(k + 1) % o.points.length]);
          if (a && b && distPointToSegment({ x, y }, a, b) <= hit) return o.id;
        }
        break;
      }
      case "angle": {
        const v = pointById(scene, o.vertex);
        if (!v) break;
        if (Math.hypot(v.x - x, v.y - y) <= 22) return o.id;
        break;
      }
      default:
        break;
    }
  }
  return null;
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
