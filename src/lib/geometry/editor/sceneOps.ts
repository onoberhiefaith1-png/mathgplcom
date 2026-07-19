// sceneOps — pure functions producing a next GeometryScene from an
// intent. Every op returns the next scene plus which ids were added or
// changed so the UI can highlight them.

import type {
  GeometryScene,
  GeoObject,
  GeoPoint,
  GeoSegment,
  GeoCircle,
  GeoArc,
  GeoAngle,
  GeoPolygon,
  GeoLabel,
  GeoRegion,
  GeoId,
} from "../scene";
import { pointById } from "../scene";
import { nextPointLabel, newId } from "./labels";

export interface OpResult {
  scene: GeometryScene;
  addedIds: GeoId[];
  changedIds: GeoId[];
}

const ok = (
  scene: GeometryScene,
  addedIds: GeoId[] = [],
  changedIds: GeoId[] = [],
): OpResult => ({ scene, addedIds, changedIds });

const withObjects = (scene: GeometryScene, objects: GeoObject[]): GeometryScene => ({
  ...scene,
  objects,
});

/* ─── Add point ─────────────────────────────────────────────────────── */
export function addPoint(scene: GeometryScene, x: number, y: number, label?: string): OpResult {
  const id = newId("p", scene);
  const p: GeoPoint = { id, type: "point", x, y, label: label ?? nextPointLabel(scene) };
  // Auto-split: if the point lands on an existing segment body, replace
  // the segment with two children that share the new point.
  const host = findSegmentAt(scene, x, y, 6);
  let objects = [...scene.objects, p];
  const added: GeoId[] = [id];
  if (host) {
    const { seg, projX, projY } = host;
    // Move the point onto the exact segment line so it sits on the edge.
    p.x = projX;
    p.y = projY;
    const s1: GeoSegment = {
      ...seg,
      id: newId("s", { ...scene, objects }),
      a: seg.a,
      b: id,
      arrow: seg.arrow === "start" || seg.arrow === "both" ? "start" : "none",
    };
    objects = [...objects.filter((o) => o.id !== seg.id), s1];
    const s2: GeoSegment = {
      ...seg,
      id: newId("s", { ...scene, objects }),
      a: id,
      b: seg.b,
      arrow: seg.arrow === "end" || seg.arrow === "both" ? "end" : "none",
      // Distance/label live on one child only to avoid duplicates.
      label: undefined,
      distance: undefined,
      length: undefined,
      distanceOffset: undefined,
      labelOffset: undefined,
    };
    objects = [...objects, s2];
    added.push(s1.id, s2.id);
  }
  return ok({ ...scene, objects }, added);
}

/** Find an existing segment whose body passes within `hit` px of (x,y). */
function findSegmentAt(
  scene: GeometryScene,
  x: number,
  y: number,
  hit: number,
): { seg: GeoSegment; projX: number; projY: number } | null {
  let best: { seg: GeoSegment; projX: number; projY: number; d: number } | null = null;
  for (const o of scene.objects) {
    if (o.type !== "segment") continue;
    const a = pointById(scene, o.a);
    const b = pointById(scene, o.b);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    // Only split if the projection lands strictly inside the segment,
    // not on its endpoints.
    if (t <= 0.05 || t >= 0.95) continue;
    const px = a.x + dx * t, py = a.y + dy * t;
    const d = Math.hypot(px - x, py - y);
    if (d <= hit && (!best || d < best.d)) best = { seg: o, projX: px, projY: py, d };
  }
  return best;
}

/* ─── Add segment between two existing points ──────────────────────── */
export function addSegment(scene: GeometryScene, a: GeoId, b: GeoId): OpResult {
  if (a === b) return ok(scene);
  const id = newId("s", scene);
  const seg: GeoSegment = { id, type: "segment", a, b };
  return ok(withObjects(scene, [...scene.objects, seg]), [id]);
}

/* ─── Polygon closure from an ordered list of point ids ─────────────── */
export function closePolygon(scene: GeometryScene, points: GeoId[]): OpResult {
  if (points.length < 3) return ok(scene);
  let next = scene;
  const added: GeoId[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    // Skip if a segment already exists
    const exists = next.objects.some(
      (o) =>
        o.type === "segment" &&
        ((o.a === a && o.b === b) || (o.a === b && o.b === a)),
    );
    if (exists) continue;
    const r = addSegment(next, a, b);
    next = r.scene;
    added.push(...r.addedIds);
  }
  const polyId = newId("poly", next);
  const poly: GeoPolygon = { id: polyId, type: "polygon", points };
  next = withObjects(next, [...next.objects, poly]);
  added.push(polyId);
  return ok(next, added);
}

/* ─── Circle by center + radius point ──────────────────────────────── */
export function addCircleByRadius(scene: GeometryScene, center: GeoId, radiusPt: GeoId): OpResult {
  const c = pointById(scene, center);
  const r = pointById(scene, radiusPt);
  if (!c || !r) return ok(scene);
  const radius = Math.hypot(r.x - c.x, r.y - c.y);
  const id = newId("c", scene);
  const circ: GeoCircle = { id, type: "circle", center, r: radius };
  return ok(withObjects(scene, [...scene.objects, circ]), [id]);
}

/** Free-drag circle (center + numeric radius). */
export function addCircleAt(scene: GeometryScene, cx: number, cy: number, r: number): OpResult {
  const cid = newId("p", scene);
  const center: GeoPoint = { id: cid, type: "point", x: cx, y: cy, label: nextPointLabel(scene) };
  const id = newId("c", { ...scene, objects: [...scene.objects, center] });
  const circ: GeoCircle = { id, type: "circle", center: cid, r };
  return ok(withObjects(scene, [...scene.objects, center, circ]), [cid, id]);
}

/* ─── Circle through three existing points (circumcircle) ───────────── */
export function addCircleThrough3(
  scene: GeometryScene,
  aId: GeoId, mId: GeoId, bId: GeoId,
): OpResult {
  const a = pointById(scene, aId);
  const m = pointById(scene, mId);
  const b = pointById(scene, bId);
  if (!a || !m || !b) return ok(scene);
  const c = circumcenter(a, m, b);
  if (!c) {
    // Collinear: degrade to a segment a→b.
    return addSegment(scene, aId, bId);
  }
  const r = Math.hypot(a.x - c.x, a.y - c.y);
  const cId = newId("p", scene);
  const center: GeoPoint = { id: cId, type: "point", x: c.x, y: c.y, hidden: true };
  const id = newId("c", { ...scene, objects: [...scene.objects, center] });
  const circ: GeoCircle = { id, type: "circle", center: cId, r };
  return ok(withObjects(scene, [...scene.objects, center, circ]), [cId, id]);
}

/* ─── Arc through 3 points ─────────────────────────────────────────── */
export function addArcThrough3(
  scene: GeometryScene,
  p1: GeoPoint, pm: GeoPoint, p2: GeoPoint,
  dashed = false,
): OpResult {
  const c = circumcenter(p1, pm, p2);
  if (!c) {
    // collinear: degrade to a segment
    return addSegment(addPoint(scene, p1.x, p1.y).scene, p1.id, p2.id);
  }
  const id = newId(dashed ? "carc" : "arc", scene);
  const r = Math.hypot(p1.x - c.x, p1.y - c.y);
  const cId = newId("p", scene);
  const center: GeoPoint = { id: cId, type: "point", x: c.x, y: c.y, hidden: true };
  // Compute angles (degrees, ccw from +x, with y growing downward we use -y)
  const ang = (p: GeoPoint) => (Math.atan2(-(p.y - c.y), p.x - c.x) * 180) / Math.PI;
  let a1 = ang(p1);
  const am = ang(pm);
  let a2 = ang(p2);
  // Normalize so the arc actually passes through pm.
  // We want a1 -> a2 going through am.
  const between = (v: number, from: number, to: number) => {
    let f = ((from % 360) + 360) % 360;
    let t = ((to % 360) + 360) % 360;
    let x = ((v % 360) + 360) % 360;
    if (f <= t) return x >= f && x <= t;
    return x >= f || x <= t;
  };
  if (!between(am, a1, a2)) {
    [a1, a2] = [a2, a1];
  }
  const arc: GeoArc = { id, type: "arc", center: cId, r, from: a1, to: a2, dashed };
  return ok(withObjects(scene, [...scene.objects, center, arc]), [cId, id]);
}

function circumcenter(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
  const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
  return { x: ux, y: uy };
}

/* ─── Angle mark ────────────────────────────────────────────────────── */
export function addAngle(scene: GeometryScene, vertex: GeoId, a: GeoId, b: GeoId, value?: string): OpResult {
  const id = newId("ang", scene);
  const ang: GeoAngle = { id, type: "angle", vertex, a, b, value, marker: "arc" };
  return ok(withObjects(scene, [...scene.objects, ang]), [id]);
}

/* ─── Label / measurement / value patch ─────────────────────────────── */
export function patchObject(scene: GeometryScene, id: GeoId, patch: Partial<GeoObject>): OpResult {
  const objects = scene.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as GeoObject) : o));
  return ok({ ...scene, objects }, [], [id]);
}

export function addFloatingLabel(scene: GeometryScene, x: number, y: number, text: string): OpResult {
  const id = newId("lbl", scene);
  const lbl: GeoLabel = { id, type: "label", x, y, text };
  return ok(withObjects(scene, [...scene.objects, lbl]), [id]);
}

/* ─── Equal mark: cycle tick → double → triple → tick ───────────────── */
export function cycleEqualMarks(scene: GeometryScene, ids: GeoId[]): OpResult {
  if (ids.length === 0) return ok(scene);
  const current = scene.objects.find((o) => o.id === ids[0] && o.type === "segment") as GeoSegment | undefined;
  const next: GeoSegment["marks"] =
    current?.marks === "tick" ? "double" :
    current?.marks === "double" ? "triple" :
    current?.marks === "triple" ? "tick" : "tick";
  let s = scene;
  for (const id of ids) s = patchObject(s, id, { marks: next }).scene;
  return ok(s, [], ids);
}

/* ─── Parallel marks ────────────────────────────────────────────────── */
export function markParallel(scene: GeometryScene, ids: GeoId[]): OpResult {
  let s = scene;
  for (const id of ids) s = patchObject(s, id, { marks: "parallel" }).scene;
  return ok(s, [], ids);
}

/* ─── Midpoint ──────────────────────────────────────────────────────── */
export function midpointOfSegment(scene: GeometryScene, segId: GeoId): OpResult {
  const seg = scene.objects.find((o) => o.id === segId && o.type === "segment") as GeoSegment | undefined;
  if (!seg) return ok(scene);
  const a = pointById(scene, seg.a);
  const b = pointById(scene, seg.b);
  if (!a || !b) return ok(scene);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return addPoint(scene, mx, my, "M");
}

/* ─── Erase ─────────────────────────────────────────────────────────── */
export function eraseObject(scene: GeometryScene, id: GeoId): OpResult {
  const target = scene.objects.find((o) => o.id === id);
  if (!target) return ok(scene);

  // Case: erasing a point that is the shared endpoint of exactly TWO
  // segments whose other endpoints are nearly collinear with it → merge
  // the two segments back into a single one.
  if (target.type === "point") {
    const incident = scene.objects.filter(
      (o): o is GeoSegment => o.type === "segment" && (o.a === id || o.b === id),
    );
    if (incident.length === 2) {
      const [s1, s2] = incident;
      const otherA = s1.a === id ? s1.b : s1.a;
      const otherB = s2.a === id ? s2.b : s2.a;
      const pA = pointById(scene, otherA);
      const pM = target;
      const pB = pointById(scene, otherB);
      if (pA && pB && otherA !== otherB && isCollinear(pA, pM, pB, 3)) {
        const merged: GeoSegment = {
          ...s1,
          id: newId("s", scene),
          a: otherA,
          b: otherB,
          arrow:
            (s1.arrow === "start" || s1.arrow === "both" ? "start" : "none") ===
              "start" &&
            (s2.arrow === "end" || s2.arrow === "both" ? "end" : "none") === "end"
              ? "both"
              : (s1.arrow === "start" || s1.arrow === "both")
                ? "start"
                : (s2.arrow === "end" || s2.arrow === "both")
                  ? "end"
                  : "none",
        };
        const objects = scene.objects
          .filter((o) => o.id !== id && o.id !== s1.id && o.id !== s2.id)
          .concat(merged);
        return ok({ ...scene, objects }, [merged.id], []);
      }
    }
  }

  // Default: drop the object and anything that references it.
  const drop = new Set<GeoId>([id]);
  if (target.type === "point") {
    for (const o of scene.objects) {
      if (
        (o.type === "segment" || o.type === "line" || o.type === "ray") &&
        (o.a === id || o.b === id)
      ) drop.add(o.id);
      else if ((o.type === "circle" || o.type === "arc") && o.center === id) drop.add(o.id);
      else if (o.type === "angle" && (o.vertex === id || o.a === id || o.b === id)) drop.add(o.id);
      else if (o.type === "polygon" && o.points.includes(id)) drop.add(o.id);
      else if (o.type === "region" && o.boundary.includes(id)) drop.add(o.id);
      else if (o.type === "curve") {
        if (o.a === id || o.mid === id || o.b === id) drop.add(o.id);
        else if (o.points?.includes(id)) drop.add(o.id);
      }

    }
  }
  return ok(withObjects(scene, scene.objects.filter((o) => !drop.has(o.id))));
}

function isCollinear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  tol = 2,
): boolean {
  // Perpendicular distance from b to line ac.
  const dx = c.x - a.x, dy = c.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const cross = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len;
  return cross <= tol;
}


/* ─── Move a point ──────────────────────────────────────────────────── */
export function movePoint(scene: GeometryScene, id: GeoId, x: number, y: number): OpResult {
  const objects = scene.objects.map((o) =>
    o.id === id && o.type === "point" ? { ...o, x, y } : o,
  );
  return ok({ ...scene, objects }, [], [id]);
}

/* ─── Rotate whole scene around its bounds center ───────────────────── */
export function rotateScene(scene: GeometryScene, degrees: number): OpResult {
  const cx = scene.bounds.width / 2;
  const cy = scene.bounds.height / 2;
  const t = (degrees * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const objects = scene.objects.map((o) => {
    if (o.type === "point") {
      const dx = o.x - cx, dy = o.y - cy;
      return { ...o, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }
    if (o.type === "label") {
      const dx = o.x - cx, dy = o.y - cy;
      return { ...o, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }
    return o;
  });
  return ok({ ...scene, objects });
}

/* ─── Constraints (simple solvers) ──────────────────────────────────── */
export function makeEqualSegments(scene: GeometryScene, segIds: GeoId[]): OpResult {
  if (segIds.length < 2) return ok(scene);
  const segs = segIds
    .map((id) => scene.objects.find((o) => o.id === id))
    .filter((o): o is GeoSegment => !!o && o.type === "segment");
  if (segs.length < 2) return ok(scene);
  // Use first as reference; scale endpoint b of each other so length matches.
  const ref = segs[0];
  const ra = pointById(scene, ref.a)!;
  const rb = pointById(scene, ref.b)!;
  const refLen = Math.hypot(rb.x - ra.x, rb.y - ra.y);
  let s = scene;
  const changed: GeoId[] = [];
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const a = pointById(s, seg.a)!;
    const b = pointById(s, seg.b)!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const k = refLen / len;
    const nb = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    s = movePoint(s, seg.b, nb.x, nb.y).scene;
    s = patchObject(s, seg.id, { marks: "tick" }).scene;
    changed.push(seg.id, seg.b);
  }
  s = patchObject(s, ref.id, { marks: "tick" }).scene;
  return ok(s, [], [ref.id, ...changed]);
}

export function makeIsosceles(scene: GeometryScene, pointIds: GeoId[]): OpResult {
  if (pointIds.length !== 3) return ok(scene);
  const [aId, bId, cId] = pointIds;
  const a = pointById(scene, aId);
  const b = pointById(scene, bId);
  const c = pointById(scene, cId);
  if (!a || !b || !c) return ok(scene);
  // Make AB = AC by moving C along its ray from A.
  const lenAB = Math.hypot(b.x - a.x, b.y - a.y);
  const lenAC = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  const k = lenAB / lenAC;
  return movePoint(scene, cId, a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k);
}

export function makeEquilateral(scene: GeometryScene, pointIds: GeoId[]): OpResult {
  if (pointIds.length !== 3) return ok(scene);
  const [aId, bId, cId] = pointIds;
  const a = pointById(scene, aId);
  const b = pointById(scene, bId);
  if (!a || !b) return ok(scene);
  // Move C to the apex of the equilateral triangle on AB.
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const h = Math.hypot(dx, dy) * Math.sqrt(3) / 2;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular up (screen y grows down → choose -y direction visually)
  const nx = -dy / len, ny = dx / len;
  const cx = mx + nx * h, cy = my + ny * h;
  return movePoint(scene, cId, cx, cy);
}

/* ─── Continuous curve through N points (smooth spline) ─────────────── */
import type { GeoCurve } from "../scene";

export function addCurve(scene: GeometryScene, pointIds: GeoId[]): OpResult {
  // Dedupe consecutive duplicates and require at least 2 distinct anchors.
  const uniq: GeoId[] = [];
  for (const id of pointIds) {
    if (uniq[uniq.length - 1] !== id) uniq.push(id);
  }
  if (uniq.length < 2) return ok(scene);
  const id = newId("cv", scene);
  const curve: GeoCurve = { id, type: "curve", points: uniq };
  return ok(withObjects(scene, [...scene.objects, curve]), [id]);
}

