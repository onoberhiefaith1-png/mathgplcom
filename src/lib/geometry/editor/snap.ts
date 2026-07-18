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
  | "angleValue"
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
  // 3b) Angle value chip (clicking "46°" opens the text panel).
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type !== "angle" || !o.value) continue;
    const v = pointById(scene, o.vertex);
    const pa = pointById(scene, o.a);
    const pb = pointById(scene, o.b);
    if (!v || !pa || !pb) continue;
    const a1 = Math.atan2(-(pa.y - v.y), pa.x - v.x);
    const a2 = Math.atan2(-(pb.y - v.y), pb.x - v.x);
    let d = a2 - a1;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    const r = 18;
    const labelAngle = o.reflex ? a1 + d / 2 + Math.PI : a1 + d / 2;
    const baseLx = v.x + Math.cos(labelAngle) * (r + 12);
    const baseLy = v.y - Math.sin(labelAngle) * (r + 12);
    const off = o.valueOffset;
    const lx = off ? baseLx + off.dx : baseLx;
    const ly = off ? baseLy + off.dy : baseLy;
    if (Math.hypot(lx - x, ly - y) <= 14) return { id: o.id, kind: "angleValue" };
  }
  // 4) Segments: pick the shortest matching segment when multiple bodies
  //    overlap the hit — protects against legacy scenes where a long
  //    parent segment still sits behind two split children.
  {
    let bestSeg: { id: string; len: number; d: number } | null = null;
    for (const o of scene.objects) {
      if (o.type !== "segment") continue;
      const a = pointById(scene, o.a); const b = pointById(scene, o.b);
      if (!a || !b) continue;
      const d = distPointToSegment({ x, y }, a, b);
      if (d > hit) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (!bestSeg || len < bestSeg.len || (len === bestSeg.len && d < bestSeg.d)) {
        bestSeg = { id: o.id, len, d };
      }
    }
    if (bestSeg) return { id: bestSeg.id, kind: "segmentBody" };
  }
  // 4b) Other shapes.
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    switch (o.type) {
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
        const ids = o.a && o.mid && o.b ? [o.a, o.mid, o.b] : (o.points ?? []);
        // Approximate curve body with several sample chords.
        const pts = ids.map((id) => pointById(scene, id)).filter((p): p is GeoPoint => !!p);
        if (pts.length >= 3) {
          const [pa, pm, pb] = pts;
          const cx = 2 * pm.x - (pa.x + pb.x) / 2;
          const cy = 2 * pm.y - (pa.y + pb.y) / 2;
          const N = 12;
          let prev = { x: pa.x, y: pa.y } as GeoPoint;
          for (let i = 1; i <= N; i++) {
            const t = i / N;
            const it = 1 - t;
            const sx = it * it * pa.x + 2 * it * t * cx + t * t * pb.x;
            const sy = it * it * pa.y + 2 * it * t * cy + t * t * pb.y;
            const next = { id: "", type: "point", x: sx, y: sy } as GeoPoint;
            if (distPointToSegment({ x, y }, prev, next) <= hit) return { id: o.id, kind: "curve" };
            prev = next;
          }
        } else if (pts.length >= 2) {
          for (let k = 0; k < pts.length - 1; k++) {
            if (distPointToSegment({ x, y }, pts[k], pts[k + 1]) <= hit) return { id: o.id, kind: "curve" };
          }
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
