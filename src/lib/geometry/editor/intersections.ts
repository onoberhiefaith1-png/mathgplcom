// Auto-intersection: wherever two structures cross, insert a Point at
// the crossing so the crossing becomes a real vertex that dissects the
// hosts. Idempotent — safe to run after every commit.
//
// Currently handles the practical pairs the teacher can draw:
//   - segment × segment
//   - segment × circle
//   - segment × arc
//   - circle  × circle
// Curves are treated as their chord for intersection purposes (an
// approximation that's good enough to seed a vertex the teacher can
// nudge later).

import type { GeometryScene, GeoObject, GeoPoint, GeoSegment, GeoCircle, GeoArc, GeoId } from "../scene";
import { pointById } from "../scene";
import { newId, nextPointLabel } from "./labels";
import { normalizeScene } from "./normalize";

const NEAR = 4; // px tolerance for "already have a point here"

function nearAnyPoint(scene: GeometryScene, x: number, y: number): boolean {
  for (const o of scene.objects) {
    if (o.type !== "point") continue;
    if (Math.hypot(o.x - x, o.y - y) <= NEAR) return true;
  }
  return false;
}

function segSegIntersect(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint): { x: number; y: number } | null {
  const r1x = b.x - a.x, r1y = b.y - a.y;
  const r2x = d.x - c.x, r2y = d.y - c.y;
  const denom = r1x * r2y - r1y * r2x;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / denom;
  const u = ((c.x - a.x) * r1y - (c.y - a.y) * r1x) / denom;
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null;
  return { x: a.x + r1x * t, y: a.y + r1y * t };
}

function segCircleIntersect(
  a: GeoPoint, b: GeoPoint, cx: number, cy: number, r: number,
): { x: number; y: number }[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - cx, fy = a.y - cy;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A < 1e-6) return [];
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A);
  const t2 = (-B + s) / (2 * A);
  const out: { x: number; y: number }[] = [];
  for (const t of [t1, t2]) {
    if (t > 0.02 && t < 0.98) out.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  return out;
}

function circleCircleIntersect(
  cx1: number, cy1: number, r1: number,
  cx2: number, cy2: number, r2: number,
): { x: number; y: number }[] {
  const d = Math.hypot(cx2 - cx1, cy2 - cy1);
  if (d < 1e-6 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const px = cx1 + (a * (cx2 - cx1)) / d;
  const py = cy1 + (a * (cy2 - cy1)) / d;
  const rx = -(cy2 - cy1) * (h / d);
  const ry = (cx2 - cx1) * (h / d);
  return [
    { x: px + rx, y: py + ry },
    { x: px - rx, y: py - ry },
  ];
}

function pointOnArc(arc: GeoArc, x: number, y: number, center: GeoPoint): boolean {
  const ang = (Math.atan2(-(y - center.y), x - center.x) * 180) / Math.PI;
  const norm = (v: number) => ((v % 360) + 360) % 360;
  const f = norm(arc.from), t = norm(arc.to), v = norm(ang);
  return f <= t ? v >= f && v <= t : v >= f || v <= t;
}

/** Insert Points at every crossing. Runs normalizeScene at the end so
 *  segments passing over the new point get dissected. Idempotent. */
export function ensureIntersectionPoints(scene: GeometryScene): GeometryScene {
  const objects = scene.objects;
  const segs = objects.filter((o): o is GeoSegment => o.type === "segment");
  const circles = objects.filter((o): o is GeoCircle => o.type === "circle");
  const arcs = objects.filter((o): o is GeoArc => o.type === "arc");

  const newPoints: GeoPoint[] = [];
  let working: GeometryScene = scene;

  const tryAdd = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (nearAnyPoint(working, x, y)) return;
    for (const np of newPoints) if (Math.hypot(np.x - x, np.y - y) <= NEAR) return;
    const id = newId("p", { ...working, objects: [...working.objects, ...newPoints] });
    const label = nextPointLabel({ ...working, objects: [...working.objects, ...newPoints] });
    newPoints.push({ id, type: "point", x, y, label, auto: true });
  };

  // segment × segment
  for (let i = 0; i < segs.length; i++) {
    const s1 = segs[i]; const a = pointById(scene, s1.a); const b = pointById(scene, s1.b);
    if (!a || !b) continue;
    for (let j = i + 1; j < segs.length; j++) {
      const s2 = segs[j]; if (s1.a === s2.a || s1.a === s2.b || s1.b === s2.a || s1.b === s2.b) continue;
      const c = pointById(scene, s2.a); const d = pointById(scene, s2.b);
      if (!c || !d) continue;
      const p = segSegIntersect(a, b, c, d);
      if (p) tryAdd(p.x, p.y);
    }
  }
  // segment × circle
  for (const s of segs) {
    const a = pointById(scene, s.a); const b = pointById(scene, s.b);
    if (!a || !b) continue;
    for (const c of circles) {
      const cc = pointById(scene, c.center); if (!cc) continue;
      for (const p of segCircleIntersect(a, b, cc.x, cc.y, c.r)) tryAdd(p.x, p.y);
    }
    for (const arc of arcs) {
      const ac = pointById(scene, arc.center); if (!ac) continue;
      for (const p of segCircleIntersect(a, b, ac.x, ac.y, arc.r)) {
        if (pointOnArc(arc, p.x, p.y, ac)) tryAdd(p.x, p.y);
      }
    }
  }
  // circle × circle
  for (let i = 0; i < circles.length; i++) {
    const c1 = circles[i]; const cc1 = pointById(scene, c1.center); if (!cc1) continue;
    for (let j = i + 1; j < circles.length; j++) {
      const c2 = circles[j]; const cc2 = pointById(scene, c2.center); if (!cc2) continue;
      for (const p of circleCircleIntersect(cc1.x, cc1.y, c1.r, cc2.x, cc2.y, c2.r)) tryAdd(p.x, p.y);
    }
  }

  if (newPoints.length === 0) return scene;
  working = { ...scene, objects: [...scene.objects, ...newPoints] };
  // Let the normaliser dissect segments that now cross the new points.
  return normalizeScene(working);
}
