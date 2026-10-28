// Diagram relevance / clean-up pass.
//
// The 2D editor deliberately creates a labelled Point wherever two
// structures cross (see intersections.ts) — that behaviour is useful while a
// teacher constructs a figure by hand and is NOT changed here.
//
// The problem is the AI-generation path: a question about P, Q, R, S ends up
// exposing E, F, G, H, I, J simply because the chords happen to cross. This
// module decides which points the mathematics actually needs and marks the
// rest `hidden` — the geometry (and the crossing) stays intact, only the dot
// and its letter stop rendering. Pure and idempotent.

import type { GeometryScene, GeoPoint, GeoId } from "../scene";

const norm = (s: string): string => (s || "").replace(/\s+/g, " ");

const labelOf = (scene: GeometryScene, id: GeoId): string => {
  const p = scene.objects.find((o) => o.id === id && o.type === "point") as GeoPoint | undefined;
  return (p?.label || "").trim();
};

/** Point labels named anywhere in the question / solution text. */
function labelsNamedInText(scene: GeometryScene, text: string): Set<string> {
  const out = new Set<string>();
  const t = norm(text);
  if (!t) return out;
  for (const o of scene.objects) {
    if (o.type !== "point") continue;
    const name = (o.label || "").trim();
    if (!name) continue;
    // A single letter counts when it appears as a standalone token, or as
    // part of a compound name (AB, ∠QSR, triangle PQR, arc QR…).
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9])[A-Z]{0,3}${esc}[A-Z]{0,3}(?![a-z0-9])`);
    if (re.test(t)) out.add(name);
  }
  return out;
}

/**
 * Ids of the points the diagram genuinely needs:
 *  - named by the question / solution text
 *  - structurally load-bearing (circle/arc centre, angle vertex or arm,
 *    polygon or region corner, endpoint of a labelled/annotated segment)
 *  - authored or edited by the teacher (not an auto intersection point)
 */
export function requiredPointIds(scene: GeometryScene, text = ""): Set<GeoId> {
  const keep = new Set<GeoId>();
  const named = labelsNamedInText(scene, text);

  for (const o of scene.objects) {
    if (o.type !== "point") continue;
    const p = o as GeoPoint;
    // Teacher-authored / non-auto points are always kept.
    if (!p.auto) { keep.add(p.id); continue; }
    if (p.hidden === false) { keep.add(p.id); continue; }
    const name = (p.label || "").trim();
    if (name && named.has(name)) keep.add(p.id);
    // Explicitly styled points were touched by a human.
    if (p.color || p.size !== undefined || p.labelFontSize !== undefined || p.labelOffset) keep.add(p.id);
  }

  for (const o of scene.objects) {
    switch (o.type) {
      case "circle":
      case "arc":
        keep.add(o.center);
        break;
      case "angle":
        keep.add(o.vertex); keep.add(o.a); keep.add(o.b);
        break;
      case "polygon":
        for (const id of o.points ?? []) keep.add(id);
        break;
      case "region":
        for (const id of (o as any).boundary ?? []) keep.add(id);
        break;
      case "curve":
        keep.add((o as any).a); keep.add((o as any).mid); keep.add((o as any).b);
        break;
      case "segment": {
        const s = o as any;
        // Only annotated segments pin their endpoints; a plain chord does
        // not justify exposing an accidental crossing letter.
        if (s.label || s.distance || s.length || s.text || s.marks) {
          keep.add(s.a); keep.add(s.b);
        }
        break;
      }
      default:
        break;
    }
  }

  return keep;
}

/**
 * Hide every auto-generated point that the mathematics does not need.
 * Never deletes geometry; never touches teacher-authored points; a point
 * that becomes referenced later is un-hidden again.
 */
export function hideIrrelevantAutoPoints(scene: GeometryScene, text = ""): GeometryScene {
  if (!scene || !Array.isArray(scene.objects)) return scene;
  const keep = requiredPointIds(scene, text);
  let changed = false;
  const objects = scene.objects.map((o) => {
    if (o.type !== "point") return o;
    const p = o as GeoPoint;
    if (!p.auto) return o;
    const wanted = keep.has(p.id);
    const nextHidden = !wanted;
    if (!!p.hidden === nextHidden) return o;
    changed = true;
    return { ...p, hidden: nextHidden } as GeoPoint;
  });
  return changed ? { ...scene, objects } : scene;
}

/** True when the scene has hidden auto points (used for UI affordances). */
export function hasHiddenAutoPoints(scene: GeometryScene): boolean {
  return scene.objects.some((o) => o.type === "point" && (o as GeoPoint).hidden && (o as GeoPoint).auto);
}
