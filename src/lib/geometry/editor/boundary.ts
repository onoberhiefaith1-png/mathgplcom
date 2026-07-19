// Boundary resolver for the "Add Area" annotation tool.
//
// Given two consecutive boundary point ids selected by the teacher, find
// the actual geometry that already connects them: a straight segment, an
// arc, part of a circle, or a curve. This lets the traced region follow
// existing curved boundaries rather than fall back to straight chords.

import type {
  GeometryScene, GeoId, GeoObject, GeoArc, GeoCircle, GeoCurve, GeoSegment, GeoRegionEdge, GeoPoint,
} from "../scene";
import { pointById } from "../scene";

const ON_TOL = 3; // px tolerance for "lies on" checks

function ptDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointLiesOnCircle(p: GeoPoint, c: GeoPoint, r: number): boolean {
  return Math.abs(ptDist(p, c) - r) <= ON_TOL;
}

function angleOf(c: { x: number; y: number }, p: { x: number; y: number }): number {
  // ccw degrees from +x, y grows downward → invert dy
  return ((Math.atan2(-(p.y - c.y), p.x - c.x) * 180) / Math.PI + 360) % 360;
}

function angleWithin(a: number, from: number, to: number): boolean {
  const f = ((from % 360) + 360) % 360;
  const t = ((to % 360) + 360) % 360;
  const x = ((a % 360) + 360) % 360;
  if (f <= t) return x >= f - 0.5 && x <= t + 0.5;
  return x >= f - 0.5 || x <= t + 0.5;
}

function endpointsMatch(id1: GeoId, id2: GeoId, a?: GeoId, b?: GeoId): boolean {
  if (!a || !b) return false;
  return (a === id1 && b === id2) || (a === id2 && b === id1);
}

/**
 * Resolve the connecting geometry between two point ids.
 * Preference order: segment > arc (endpoints or on-arc) > circle (both on) > curve.
 */
export function findConnectingEdge(
  scene: GeometryScene,
  pId: GeoId,
  qId: GeoId,
): GeoRegionEdge {
  const p = pointById(scene, pId);
  const q = pointById(scene, qId);
  if (!p || !q) return { kind: "straight" };

  // 1) Straight segment with matching endpoints.
  for (const o of scene.objects) {
    if (o.type !== "segment") continue;
    if (endpointsMatch(pId, qId, o.a, o.b)) {
      return { kind: "segment", ref: o.id };
    }
  }

  // 2) Arc: prefer arcs whose endpoints match; else arcs on which both lie.
  for (const o of scene.objects) {
    if (o.type !== "arc") continue;
    const a = o as GeoArc;
    const c = pointById(scene, a.center);
    if (!c) continue;
    if (pointLiesOnCircle(p, c, a.r) && pointLiesOnCircle(q, c, a.r)) {
      const pa = angleOf(c, p);
      const qa = angleOf(c, q);
      if (angleWithin(pa, a.from, a.to) && angleWithin(qa, a.from, a.to)) {
        return { kind: "arc", ref: a.id, sweep: "short" };
      }
    }
  }

  // 3) Circle: both points lie on it.
  for (const o of scene.objects) {
    if (o.type !== "circle") continue;
    const c = o as GeoCircle;
    const ctr = pointById(scene, c.center);
    if (!ctr) continue;
    if (pointLiesOnCircle(p, ctr, c.r) && pointLiesOnCircle(q, ctr, c.r)) {
      return { kind: "circle", ref: c.id, sweep: "short" };
    }
  }

  // 4) Curve whose endpoints match.
  for (const o of scene.objects) {
    if (o.type !== "curve") continue;
    const c = o as GeoCurve;
    if (endpointsMatch(pId, qId, c.a, c.b)) return { kind: "curve", ref: c.id };
    const pts = c.points;
    if (pts && pts.length >= 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (endpointsMatch(pId, qId, first, last)) return { kind: "curve", ref: c.id };
    }
  }

  return { kind: "straight" };
}

/**
 * Build an SVG path `d` string for a region given its boundary + edges,
 * using the current scene's point positions. `pad` is the render offset.
 */
export function regionEdgesToPath(
  scene: GeometryScene,
  boundary: GeoId[],
  edges: GeoRegionEdge[] | undefined,
  pad: number,
): string {
  if (boundary.length < 2) return "";
  const pts = boundary.map((id) => pointById(scene, id));
  if (pts.some((p) => !p)) return "";
  const P = pts as GeoPoint[];
  const px = (p: GeoPoint) => p.x + pad;
  const py = (p: GeoPoint) => p.y + pad;

  let d = `M ${px(P[0])} ${py(P[0])}`;
  for (let i = 0; i < P.length; i++) {
    const from = P[i];
    const to = P[(i + 1) % P.length];
    const edge = edges?.[i] ?? { kind: "straight" as const };
    d += " " + edgeSegmentPath(scene, from, to, edge, pad);
  }
  d += " Z";
  return d;
}

function edgeSegmentPath(
  scene: GeometryScene,
  from: GeoPoint,
  to: GeoPoint,
  edge: GeoRegionEdge,
  pad: number,
): string {
  const tox = to.x + pad, toy = to.y + pad;
  if (edge.kind === "arc" || edge.kind === "circle") {
    const ref = scene.objects.find((o) => o.id === edge.ref);
    if (ref && (ref.type === "arc" || ref.type === "circle")) {
      const c = pointById(scene, (ref as GeoArc | GeoCircle).center);
      const r = (ref as GeoArc | GeoCircle).r;
      if (c) {
        // Compute sweep direction: short arc unless "long" requested.
        const a1 = angleOf(c, from);
        const a2 = angleOf(c, to);
        let delta = a2 - a1;
        while (delta <= -180) delta += 360;
        while (delta > 180) delta -= 360;
        const sweepDir = delta >= 0 ? 0 : 1; // svg sweep-flag with y-down inversion
        const useLong = edge.sweep === "long";
        const large = useLong ? 1 : 0;
        return `A ${r} ${r} 0 ${large} ${sweepDir} ${tox} ${toy}`;
      }
    }
  }
  if (edge.kind === "curve") {
    const ref = scene.objects.find((o) => o.id === edge.ref);
    if (ref && ref.type === "curve") {
      const cv = ref as GeoCurve;
      if (cv.a && cv.mid && cv.b) {
        const pm = pointById(scene, cv.mid);
        const pa = pointById(scene, cv.a);
        const pb = pointById(scene, cv.b);
        if (pm && pa && pb) {
          // Direction: from → to along the curve. If from matches cv.a,
          // control ≈ derived from mid; otherwise mirror.
          const cx = 2 * pm.x - (pa.x + pb.x) / 2 + pad;
          const cy = 2 * pm.y - (pa.y + pb.y) / 2 + pad;
          return `Q ${cx} ${cy} ${tox} ${toy}`;
        }
      }
    }
  }
  return `L ${tox} ${toy}`;
}
