// Review selectors — the read side of the teacher-authored Geometry
// Properties, used by the Smartboard's Review Properties panel.
//
// Everything here is pure and id-based: no AI, no text searching, no fetch.
// A property matches an object only when it references that object's stable
// id, directly or through a teacher-defined part (virtual angle, distance,
// unknown) that was built from it.

import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import {
  connectionsOf,
  resolveHighlightIds,
  type GeometryPropertiesDoc,
  type GeometryPropertyItem,
} from "./model";

const base = (id: string): string => id.split("#")[0];

/** Items the audience is allowed to review. */
export function reviewableItems(
  doc: GeometryPropertiesDoc,
  role: "teacher" | "student",
): GeometryPropertyItem[] {
  if (doc.access === "off") return [];
  const items = doc.items
    .filter((i) => i.enabled !== false && i.approved !== false)
    .sort((a, b) => a.order - b.order);
  if (role === "teacher") return items;
  if (!doc.published) return [];
  if (doc.access === "specific") return items.filter((i) => i.category === "specific");
  if (doc.access === "general") return items.filter((i) => i.category === "general");
  return items;
}

/**
 * Every real diagram object id a property touches — its own connections plus
 * the objects behind any teacher-defined part it references.
 */
export function propertyObjectIds(
  doc: GeometryPropertiesDoc,
  item: GeometryPropertyItem,
): GeoId[] {
  const raw = [...new Set([...item.sourceObjectIds, ...connectionsOf(item)])];
  return resolveHighlightIds(doc, raw);
}

/** Properties that reference this exact object id (directly or via a part). */
export function itemsForObjectId(
  doc: GeometryPropertiesDoc,
  items: GeometryPropertyItem[],
  objectId: GeoId,
): GeometryPropertyItem[] {
  const target = base(objectId);
  return items.filter((item) =>
    propertyObjectIds(doc, item).some((id) => base(id) === target),
  );
}

/** Object ids in this diagram that carry at least one reviewable property. */
export function objectsWithProperties(
  scene: GeometryScene,
  doc: GeometryPropertiesDoc,
  items: GeometryPropertyItem[],
): Set<GeoId> {
  const alive = new Set(scene.objects.map((o) => o.id));
  const out = new Set<GeoId>();
  for (const item of items) {
    for (const id of propertyObjectIds(doc, item)) {
      if (alive.has(base(id))) out.add(base(id));
    }
  }
  return out;
}
