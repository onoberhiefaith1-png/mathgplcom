// Recognize — turn a GeometryScene into a SmartGraph of math parts.
// Phase 1: triangles (vertices, sides, interior angles, midpoints) and
// circles (centre, radius, diameter, chord, arc, points on circumference).

import type { GeometryScene, GeoPoint, GeoSegment, GeoCircle, GeoArc, GeoAngle } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";
import type { SmartGraph, SmartPartBase } from "./parts";

const labelOf = (p: GeoPoint, fallback: string) => p.label?.trim() || fallback;

export function recognize(scene: GeometryScene): SmartGraph {
  const parts: SmartPartBase[] = [];
  const pushed = new Set<string>();
  const add = (p: SmartPartBase) => {
    if (pushed.has(p.id)) return;
    pushed.add(p.id);
    parts.push(p);
  };

  // ---- Vertices (every visible point) ----
  for (const o of scene.objects) {
    if (o.type !== "point" || o.hidden) continue;
    const p = o;
    add({
      id: `vertex:${p.id}`,
      kind: "vertex",
      label: labelOf(p, "•"),
      sourceObjectIds: [p.id],
      anchor: { x: p.x, y: p.y },
      hit: { kind: "point", x: p.x, y: p.y, r: 8 },
    });
  }

  // ---- Segments / sides ----
  const segments = scene.objects.filter((o): o is GeoSegment => o.type === "segment");
  for (const s of segments) {
    const a = pointById(scene, s.a);
    const b = pointById(scene, s.b);
    if (!a || !b) continue;
    const al = labelOf(a, "?");
    const bl = labelOf(b, "?");
    const len = s.length ? Number(s.length.replace(/[^0-9.\-]/g, "")) : undefined;
    add({
      id: `side:${s.id}`,
      kind: "side",
      label: s.label || `${al}${bl}`,
      sourceObjectIds: [s.id, s.a, s.b],
      anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      hit: { kind: "segment", x1: a.x, y1: a.y, x2: b.x, y2: b.y },
      value: Number.isFinite(len) ? len : undefined,
      unit: "len",
    });
  }

  // ---- Triangles (3 segments sharing 3 distinct endpoints) ----
  const segByPts = new Map<string, GeoSegment>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  segments.forEach((s) => segByPts.set(key(s.a, s.b), s));
  const pointIds = scene.objects.filter((o) => o.type === "point").map((o) => o.id);
  const triangleIds: string[] = [];
  for (let i = 0; i < pointIds.length; i++) {
    for (let j = i + 1; j < pointIds.length; j++) {
      for (let k = j + 1; k < pointIds.length; k++) {
        const a = pointIds[i], b = pointIds[j], c = pointIds[k];
        if (segByPts.has(key(a, b)) && segByPts.has(key(b, c)) && segByPts.has(key(a, c))) {
          const pa = pointById(scene, a)!;
          const pb = pointById(scene, b)!;
          const pc = pointById(scene, c)!;
          const cx = (pa.x + pb.x + pc.x) / 3;
          const cy = (pa.y + pb.y + pc.y) / 3;
          const tri: SmartPartBase = {
            id: `triangle:${a}-${b}-${c}`,
            kind: "triangle",
            label: `△${labelOf(pa, "A")}${labelOf(pb, "B")}${labelOf(pc, "C")}`,
            sourceObjectIds: [a, b, c],
            anchor: { x: cx, y: cy },
            hit: { kind: "point", x: cx, y: cy, r: 10 },
          };
          add(tri);
          triangleIds.push(tri.id);

          // Interior angles at each vertex (derived from triangle, only if not
          // already provided by an explicit GeoAngle).
          const verts: Array<[GeoPoint, GeoPoint, GeoPoint]> = [
            [pa, pb, pc],
            [pb, pa, pc],
            [pc, pa, pb],
          ];
          for (const [v, u, w] of verts) {
            add({
              id: `angle:vertex:${v.id}@${tri.id}`,
              kind: "angle",
              label: `∠${labelOf(v, "?")}`,
              sourceObjectIds: [v.id, u.id, w.id],
              anchor: { x: v.x, y: v.y },
              hit: { kind: "point", x: v.x, y: v.y, r: 18 },
              value: interiorAngleDeg(v, u, w),
              unit: "deg",
            });
          }
        }
      }
    }
  }

  // ---- Explicit angle objects (override derived) ----
  for (const o of scene.objects) {
    if (o.type !== "angle") continue;
    const a = o as GeoAngle;
    const v = pointById(scene, a.vertex);
    if (!v) continue;
    const numeric = a.value ? Number(a.value.replace(/[^0-9.\-]/g, "")) : undefined;
    add({
      id: `angle:obj:${a.id}`,
      kind: "angle",
      label: `∠${labelOf(v, "?")}${a.value ? ` = ${a.value}` : ""}`,
      sourceObjectIds: [a.id, a.vertex, a.a, a.b],
      anchor: { x: v.x, y: v.y },
      hit: { kind: "point", x: v.x, y: v.y, r: 18 },
      value: Number.isFinite(numeric) ? numeric : undefined,
      unit: "deg",
    });
  }

  // ---- Circles ----
  const circles = scene.objects.filter((o): o is GeoCircle => o.type === "circle");
  for (const c of circles) {
    const centre = pointById(scene, c.center);
    if (!centre) continue;
    add({
      id: `centre:${c.id}`,
      kind: "centre",
      label: `centre ${labelOf(centre, "O")}`,
      sourceObjectIds: [c.center],
      anchor: { x: centre.x, y: centre.y },
      hit: { kind: "point", x: centre.x, y: centre.y, r: 10 },
    });
    add({
      id: `circle:${c.id}`,
      kind: "circle",
      label: c.label || `circle ${labelOf(centre, "O")}`,
      sourceObjectIds: [c.id, c.center],
      anchor: { x: centre.x + c.r, y: centre.y },
      hit: { kind: "circle", cx: centre.x, cy: centre.y, r: c.r },
      value: c.r,
      unit: "len",
    });
    // Radius (logical) = any point on circle to centre. We synthesise one radius
    // to the +x; explicit radii come from segments with one endpoint = centre
    // and the other lying on the circle.
    for (const s of segments) {
      const a = pointById(scene, s.a);
      const b = pointById(scene, s.b);
      if (!a || !b) continue;
      const aOnC = Math.abs(Math.hypot(a.x - centre.x, a.y - centre.y) - c.r) < 1.5;
      const bOnC = Math.abs(Math.hypot(b.x - centre.x, b.y - centre.y) - c.r) < 1.5;
      const aIsCentre = a.id === c.center;
      const bIsCentre = b.id === c.center;
      if ((aIsCentre && bOnC) || (bIsCentre && aOnC)) {
        const tip = aIsCentre ? b : a;
        add({
          id: `radius:${c.id}:${s.id}`,
          kind: "radius",
          label: `radius ${labelOf(centre, "O")}${labelOf(tip, "?")}`,
          sourceObjectIds: [s.id, c.id],
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          hit: { kind: "segment", x1: a.x, y1: a.y, x2: b.x, y2: b.y },
          value: c.r,
          unit: "len",
        });
      } else if (aOnC && bOnC) {
        const passesCentre =
          distPointToSegment(centre.x, centre.y, a.x, a.y, b.x, b.y) < 1.5;
        add({
          id: `${passesCentre ? "diameter" : "chord"}:${s.id}`,
          kind: passesCentre ? "diameter" : "chord",
          label: `${passesCentre ? "diameter" : "chord"} ${labelOf(a, "?")}${labelOf(b, "?")}`,
          sourceObjectIds: [s.id, c.id],
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          hit: { kind: "segment", x1: a.x, y1: a.y, x2: b.x, y2: b.y },
          value: passesCentre ? 2 * c.r : Math.hypot(a.x - b.x, a.y - b.y),
          unit: "len",
        });
      } else {
        // Tangent: segment touches the circle at exactly one of its endpoints.
        const aTouch = Math.abs(Math.hypot(a.x - centre.x, a.y - centre.y) - c.r) < 1.5;
        const bTouch = Math.abs(Math.hypot(b.x - centre.x, b.y - centre.y) - c.r) < 1.5;
        if (aTouch !== bTouch) {
          add({
            id: `tangent:${c.id}:${s.id}`,
            kind: "tangent",
            label: `tangent at ${labelOf(aTouch ? a : b, "?")}`,
            sourceObjectIds: [s.id, c.id],
            anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            hit: { kind: "segment", x1: a.x, y1: a.y, x2: b.x, y2: b.y },
          });
        }
      }
    }

    // Points on circumference
    for (const o of scene.objects) {
      if (o.type !== "point" || o.hidden) continue;
      if (o.id === c.center) continue;
      const d = Math.hypot(o.x - centre.x, o.y - centre.y);
      if (Math.abs(d - c.r) < 1.5) {
        add({
          id: `pointOnCircle:${c.id}:${o.id}`,
          kind: "pointOnCircle",
          label: `${labelOf(o, "?")} on circle`,
          sourceObjectIds: [o.id, c.id],
          anchor: { x: o.x, y: o.y },
          hit: { kind: "point", x: o.x, y: o.y, r: 8 },
        });
      }
    }
  }

  // ---- Arcs ----
  for (const o of scene.objects) {
    if (o.type !== "arc") continue;
    const a = o as GeoArc;
    const c = pointById(scene, a.center);
    if (!c) continue;
    add({
      id: `arc:${a.id}`,
      kind: "arc",
      label: `arc`,
      sourceObjectIds: [a.id, a.center],
      anchor: { x: c.x + a.r, y: c.y },
      hit: { kind: "arc", cx: c.x, cy: c.y, r: a.r, from: a.from, to: a.to },
    });
  }

  const byId = new Map(parts.map((p) => [p.id, p]));
  return { parts, byId, triangleIds, scene };
}

function interiorAngleDeg(v: GeoPoint, u: GeoPoint, w: GeoPoint): number {
  const ax = u.x - v.x, ay = u.y - v.y;
  const bx = w.x - v.x, by = w.y - v.y;
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI));
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
