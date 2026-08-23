// Smart-snap: find nearest snappable target within a pixel threshold.

import type { GeometryScene, GeoPoint } from "../scene";
import { pointById } from "../scene";
import { labelCenter, labelTextMetrics, unrotatePoint } from "../textRotation";

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
  | "segmentText"
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
  // 1) Point dot (highest priority). Hidden points are still selectable so a
  //    teacher can pick a ghosted construction point and un-hide it; drawing
  //    snap (see `snap`) continues to ignore them.
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type === "point" && Math.hypot(o.x - x, o.y - y) <= hit) {
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
    if (o.lineText) {
      const off = o.lineTextOffset;
      const lx = off ? mx + off.dx : mx + nx * 28;
      const ly = off ? my + off.dy : my + ny * 28;
      if (Math.hypot(lx - x, ly - y) <= 16) return { id: o.id, kind: "segmentText" };
    }
  }
  // 3a) Floating text (any words/measurement placed in the diagram).
  //     Tested before line bodies so text sitting on top of a line is the
  //     thing that gets picked — every label must be selectable/draggable.
  for (let i = scene.objects.length - 1; i >= 0; i--) {
    const o = scene.objects[i];
    if (o.type !== "label" || !o.text) continue;
    const { width: w, height: h } = labelTextMetrics(o);
    // Rotated text: map the pointer back into the text's own frame first so
    // rotated words stay selectable and draggable.
    const p = unrotatePoint({ x, y }, labelCenter(o), o.rotation ?? 0);
    // Text is centre-anchored on (x, y) with the baseline at y.
    if (
      p.x >= o.x - w / 2 - 3 && p.x <= o.x + w / 2 + 3 &&
      p.y >= o.y - h && p.y <= o.y + h * 0.35
    ) {
      return { id: o.id, kind: "label" };
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
    const r = o.arcRadius ?? 18;
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
        if (Math.abs(Math.hypot(c.x - x, c.y - y) - o.r) > hit) break;
        // Highlight law: if the circle carries 2+ named points on its
        // perimeter, only the sub-arc between two adjacent points can
        // be selected — never the whole loop.
        const onCircle = pointsOnCircle(scene, o.center, o.r);
        if (onCircle.length >= 2) {
          const sub = pickCircleSubArc(c, onCircle, x, y);
          return { id: `${o.id}#${sub}`, kind: "circle" };
        }
        return { id: o.id, kind: "circle" };
      }
      case "arc": {
        const c = pointById(scene, o.center); if (!c) break;
        if (Math.abs(Math.hypot(c.x - x, c.y - y) - o.r) > hit) break;
        const onArc = pointsOnArc(scene, o.center, o.r, o.from, o.to);
        if (onArc.length >= 2) {
          const sub = pickArcSubArc(c, o.from, o.to, onArc, x, y);
          return { id: `${o.id}#${sub}`, kind: "arc" };
        }
        return { id: o.id, kind: "arc" };
      }
      case "curve": {
        if (o.a && o.mid && o.b) {
          // Approximate legacy quadratic curve body with several sample chords.
          const pts = [o.a, o.mid, o.b].map((id) => pointById(scene, id)).filter((p): p is GeoPoint => !!p);
          if (pts.length < 3) break;
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
        } else {
          const anchors = (o.points ?? []).map((id) => pointById(scene, id)).filter((p): p is GeoPoint => !!p);
          if (anchors.length >= 2) {
            // Enforce "max 2 points" rule: return the sub-span between the
            // two anchors nearest the click as a composite id "curveId#i".
            const STEPS = 10;
            let bestSub = -1;
            let bestDist = hit;
            for (let seg = 0; seg < anchors.length - 1; seg++) {
              const sampled = sampleCatmullRomBetween(anchors, seg, STEPS);
              for (let k = 0; k < sampled.length - 1; k++) {
                const d = distPointToSegment({ x, y }, sampled[k], sampled[k + 1]);
                if (d < bestDist) { bestDist = d; bestSub = seg; }
              }
            }
            if (bestSub >= 0) return { id: `${o.id}#${bestSub}`, kind: "curve" };
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

function sampleCatmullRom(pts: GeoPoint[], stepsPerSegment = 8): GeoPoint[] {
  if (pts.length < 2) return pts;
  if (pts.length === 2) return pts;
  const out: GeoPoint[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push(...sampleCatmullRomBetween(pts, i, stepsPerSegment).slice(1));
  }
  return out;
}

/** Sample a single Catmull-Rom sub-span between anchors[seg] and anchors[seg+1]. */
export function sampleCatmullRomBetween(pts: GeoPoint[], seg: number, stepsPerSegment = 10): GeoPoint[] {
  const i = seg;
  const p0 = pts[i - 1] ?? pts[i];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  if (!p1 || !p2) return [];
  const p3 = pts[i + 2] ?? p2;
  const out: GeoPoint[] = [{ id: "", type: "point", x: p1.x, y: p1.y }];
  for (let s = 1; s <= stepsPerSegment; s++) {
    const t = s / stepsPerSegment;
    const t2 = t * t;
    const t3 = t2 * t;
    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    out.push({ id: "", type: "point", x, y });
  }
  return out;
}

/** Points that lie on a given circle (within a small tolerance). */
export function pointsOnCircle(scene: GeometryScene, centerId: string, r: number, tol = 3): GeoPoint[] {
  const c = pointById(scene, centerId);
  if (!c) return [];
  return scene.objects.filter(
    (o): o is GeoPoint =>
      o.type === "point" && !o.hidden && o.id !== centerId &&
      Math.abs(Math.hypot(o.x - c.x, o.y - c.y) - r) <= tol,
  );
}

/** Points that lie on a given arc's underlying circle AND within its sweep. */
export function pointsOnArc(scene: GeometryScene, centerId: string, r: number, from: number, to: number, tol = 3): GeoPoint[] {
  const c = pointById(scene, centerId);
  if (!c) return [];
  const onCircle = pointsOnCircle(scene, centerId, r, tol);
  const inSweep = (deg: number) => {
    let f = ((from % 360) + 360) % 360;
    let t = ((to % 360) + 360) % 360;
    let v = ((deg % 360) + 360) % 360;
    if (f <= t) return v >= f && v <= t;
    return v >= f || v <= t;
  };
  return onCircle.filter((p) => {
    const ang = (Math.atan2(-(p.y - c.y), p.x - c.x) * 180) / Math.PI;
    return inSweep(ang);
  });
}

/** Return the index of the sub-arc between adjacent circle points the point (x,y) sits on. */
export function pickCircleSubArc(center: GeoPoint, pts: GeoPoint[], x: number, y: number): number {
  const angs = pts
    .map((p, i) => ({ i, a: normDeg((Math.atan2(-(p.y - center.y), p.x - center.x) * 180) / Math.PI) }))
    .sort((a, b) => a.a - b.a);
  const click = normDeg((Math.atan2(-(y - center.y), x - center.x) * 180) / Math.PI);
  for (let k = 0; k < angs.length; k++) {
    const a = angs[k].a;
    const b = angs[(k + 1) % angs.length].a;
    if (a <= b ? click >= a && click <= b : click >= a || click <= b) return k;
  }
  return 0;
}

/** Sub-arc index within an existing arc (bounded by from → to). */
export function pickArcSubArc(center: GeoPoint, from: number, to: number, pts: GeoPoint[], x: number, y: number): number {
  // Anchor list: from, ...points sorted along sweep, to
  const inSweep = (v: number) => {
    let f = normDeg(from), t = normDeg(to), n = normDeg(v);
    if (f <= t) return n >= f && n <= t;
    return n >= f || n <= t;
  };
  const along = (v: number) => {
    const f = normDeg(from);
    const n = normDeg(v);
    return normDeg(n - f);
  };
  const anchors = pts
    .map((p) => normDeg((Math.atan2(-(p.y - center.y), p.x - center.x) * 180) / Math.PI))
    .filter(inSweep)
    .sort((a, b) => along(a) - along(b));
  const full = [normDeg(from), ...anchors, normDeg(to)];
  const click = normDeg((Math.atan2(-(y - center.y), x - center.x) * 180) / Math.PI);
  const clickAlong = along(click);
  for (let k = 0; k < full.length - 1; k++) {
    if (clickAlong >= along(full[k]) && clickAlong <= along(full[k + 1])) return k;
  }
  return 0;
}

function normDeg(v: number): number {
  return ((v % 360) + 360) % 360;
}


