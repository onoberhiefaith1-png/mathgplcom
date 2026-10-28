// Scene normaliser — runs once on scene load to enforce the rule:
// "a segment never crosses over a third existing point". Any segment
// whose body passes near an existing point (that isn't one of its
// endpoints) is split at that point, and the parent segment removed.
// This gives legacy diagrams — drawn before auto-split-on-drop existed —
// the same DE/EO independence that new drawings get automatically.

import type { GeometryScene, GeoSegment, GeoPoint, GeoObject } from "../scene";
import { pointById } from "../scene";
import { newId } from "./labels";

const TOL = 3; // px perpendicular distance from segment for a point to be "on" it

function pointOnSegment(seg: GeoSegment, p: GeoPoint, scene: GeometryScene): boolean {
  if (p.id === seg.a || p.id === seg.b) return false;
  const a = pointById(scene, seg.a);
  const b = pointById(scene, seg.b);
  if (!a || !b) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t <= 0.02 || t >= 0.98) return false;
  const px = a.x + dx * t, py = a.y + dy * t;
  return Math.hypot(px - p.x, py - p.y) <= TOL;
}

/** Return the point-id that most needs to split `seg`, or null. */
function findCrossingPoint(seg: GeoSegment, scene: GeometryScene): GeoPoint | null {
  for (const o of scene.objects) {
    if (o.type !== "point" || o.hidden) continue;
    if (pointOnSegment(seg, o, scene)) return o;
  }
  return null;
}

/**
 * Legacy circles stored only a numeric radius, so there was nothing on the
 * circumference to grab. Give every such circle a rim point at exactly that
 * radius. It is hidden, so old diagrams look identical, but the circle is now
 * a real centre + rim construction and stays adjustable. Idempotent.
 */
function ensureCircleRimPoints(scene: GeometryScene): GeometryScene {
  const missing = scene.objects.filter(
    (o) => o.type === "circle" && (!o.rim || !pointById(scene, o.rim)),
  );
  if (missing.length === 0) return scene;
  let objects: GeoObject[] = [...scene.objects];
  for (const o of missing) {
    if (o.type !== "circle") continue;
    const c = pointById({ ...scene, objects }, o.center);
    if (!c) continue;
    const rid = newId("p", { ...scene, objects });
    const rim: GeoPoint = { id: rid, type: "point", x: c.x + o.r, y: c.y, hidden: true };
    objects = objects
      .map((x) => (x.id === o.id ? { ...o, rim: rid } : x))
      .concat(rim);
  }
  return { ...scene, objects };
}

/** Split every segment that crosses over a third point. Idempotent. */
export function normalizeScene(input: GeometryScene): GeometryScene {
  const scene = ensureCircleRimPoints(input);
  let objects: GeoObject[] = [...scene.objects];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    const working: GeometryScene = { ...scene, objects };
    for (const o of objects) {
      if (o.type !== "segment") continue;
      const p = findCrossingPoint(o, working);
      if (!p) continue;
      // Split o into (o.a → p) and (p → o.b), inherit style, drop parent.
      const s1: GeoSegment = {
        ...o,
        id: newId("s", { ...working, objects }),
        a: o.a,
        b: p.id,
        arrow: o.arrow === "start" || o.arrow === "both" ? "start" : "none",
      };
      const s2: GeoSegment = {
        ...o,
        id: newId("s", { ...working, objects: [...objects, s1] }),
        a: p.id,
        b: o.b,
        arrow: o.arrow === "end" || o.arrow === "both" ? "end" : "none",
        // Text/measurement lives on the first child only to avoid duplicates.
        label: undefined,
        labelOffset: undefined,
        distance: undefined,
        distanceOffset: undefined,
        length: undefined,
      };
      objects = objects.filter((x) => x.id !== o.id).concat(s1, s2);
      changed = true;
      break;
    }
  }
  if (objects === scene.objects) return scene;
  return { ...scene, objects };
}
