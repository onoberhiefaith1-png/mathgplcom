// Geometry Properties — the teacher-authored relationship map that sits on
// top of an existing GeometryScene.
//
// Everything here references diagram objects by their STABLE id
// (e.g. "p_83af"), never by the visible label, so renaming a point never
// breaks a relationship. The guide travels with the scene (scene.meta), so a
// class copy, a slide and a published note all carry the same map.

import type { GeoId, GeoObject, GeometryScene } from "@/lib/geometry/scene";
import { pointById } from "@/lib/geometry/scene";

export type PropertyCategory = "specific" | "general";

export type PropertyKind =
  | "statement"
  | "definition"
  | "theorem"
  | "property"
  | "formula"
  | "construction"
  | "note";

export const PROPERTY_KINDS: { value: PropertyKind; label: string }[] = [
  { value: "statement", label: "Statement" },
  { value: "definition", label: "Definition" },
  { value: "theorem", label: "Theorem" },
  { value: "property", label: "Property" },
  { value: "formula", label: "Formula" },
  { value: "construction", label: "Construction" },
  { value: "note", label: "Explanation" },
];

export type GuideAccess = "off" | "specific" | "general" | "both";

/** A symbol inside the relationship text bound to a diagram object. */
export interface TokenBinding {
  token: string;
  objectId: GeoId;
}

export interface GeometryPropertyItem {
  id: string;
  category: PropertyCategory;
  kind: PropertyKind;
  /** The teacher's text / formula, exactly as authored. */
  content: string;
  /** The object(s) this relationship was authored from. */
  sourceObjectIds: GeoId[];
  /** Every diagram object the relationship involves (any number, any type). */
  connectedObjectIds: GeoId[];
  /** Optional symbol → object bindings ("X" is this segment, "θ" is this angle). */
  tokens?: TokenBinding[];
  aiGenerated?: boolean;
  /** AI drafts start unapproved; teacher content is approved on save. */
  approved?: boolean;
  enabled?: boolean;
  order: number;
}

/**
 * A part of the diagram the teacher wants to talk about that is not drawn as
 * its own object — ∠ABC identified from a vertex + two arms, a distance on a
 * segment, an unknown such as x / θ. It is NOT a second diagram: it only
 * references real object ids, so highlighting resolves back to the diagram.
 */
export type VirtualKind = "angle" | "distance" | "arc" | "area" | "unknown";

export const VIRTUAL_KINDS: { value: VirtualKind; label: string; hint: string }[] = [
  { value: "angle", label: "Angle", hint: "Pick the vertex, then the two arms" },
  { value: "distance", label: "Distance", hint: "Pick the line or the two endpoints" },
  { value: "arc", label: "Arc", hint: "Pick the arc / circle and its endpoints" },
  { value: "area", label: "Area", hint: "Pick the objects that bound the area" },
  { value: "unknown", label: "Unknown / value", hint: "Pick what x, y or θ belongs to" },
];

export interface VirtualObject {
  id: GeoId;
  kind: VirtualKind;
  /** Display name — auto-built for angles (∠ABC), typed for unknowns. */
  name: string;
  /** Real diagram objects this part is made of. */
  refIds: GeoId[];
}

export interface GeometryPropertiesDoc {
  version: 1;
  access: GuideAccess;
  /** Published = students may see the approved+enabled items. */
  published?: boolean;
  items: GeometryPropertyItem[];
  /** Teacher-defined parts that are not drawn objects. */
  virtuals?: VirtualObject[];
}

export const EMPTY_PROPERTIES: GeometryPropertiesDoc = {
  version: 1,
  access: "both",
  published: false,
  items: [],
  virtuals: [],
};

export function newPropertyId(): string {
  return `gp_${Math.random().toString(36).slice(2, 10)}`;
}

export function newVirtualId(): GeoId {
  return `v_${Math.random().toString(36).slice(2, 10)}`;
}

export function isVirtualId(id: string): boolean {
  return id.startsWith("v_");
}


/* ───────────── reading / writing on the scene ───────────── */

export function readProperties(scene: GeometryScene): GeometryPropertiesDoc {
  const raw = (scene.meta as Record<string, unknown> | undefined)?.geometryProperties;
  const doc = sanitize(raw);
  if (doc) return doc;
  return migrateLegacy(scene) ?? EMPTY_PROPERTIES;
}

export function writeProperties(
  scene: GeometryScene,
  doc: GeometryPropertiesDoc,
): GeometryScene {
  return {
    ...scene,
    meta: { ...(scene.meta ?? {}), geometryProperties: doc },
  };
}

function sanitize(raw: unknown): GeometryPropertiesDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GeometryPropertiesDoc>;
  if (!Array.isArray(r.items)) return null;
  const items: GeometryPropertyItem[] = [];
  r.items.forEach((it, i) => {
    if (!it || typeof it !== "object") return;
    const item = it as Partial<GeometryPropertyItem>;
    if (typeof item.content !== "string" || !item.content.trim()) return;
    items.push({
      id: typeof item.id === "string" ? item.id : newPropertyId(),
      category: item.category === "general" ? "general" : "specific",
      kind: (PROPERTY_KINDS.some((k) => k.value === item.kind)
        ? item.kind
        : "statement") as PropertyKind,
      content: item.content,
      sourceObjectIds: Array.isArray(item.sourceObjectIds)
        ? item.sourceObjectIds.filter((x): x is string => typeof x === "string")
        : [],
      connectedObjectIds: Array.isArray(item.connectedObjectIds)
        ? item.connectedObjectIds.filter((x): x is string => typeof x === "string")
        : [],
      tokens: Array.isArray(item.tokens)
        ? (item.tokens as TokenBinding[]).filter(
            (t) => t && typeof t.token === "string" && typeof t.objectId === "string",
          )
        : undefined,
      aiGenerated: !!item.aiGenerated,
      approved: item.approved !== false,
      enabled: item.enabled !== false,
      order: typeof item.order === "number" ? item.order : i,
    });
  });
  const access: GuideAccess =
    r.access === "off" || r.access === "specific" || r.access === "general"
      ? r.access
      : "both";
  const virtuals: VirtualObject[] = Array.isArray(r.virtuals)
    ? r.virtuals
        .filter((v): v is VirtualObject =>
          !!v && typeof v === "object" &&
          typeof (v as VirtualObject).id === "string" &&
          typeof (v as VirtualObject).name === "string" &&
          Array.isArray((v as VirtualObject).refIds),
        )
        .map((v) => ({
          id: v.id,
          kind: VIRTUAL_KINDS.some((k) => k.value === v.kind) ? v.kind : "unknown",
          name: v.name,
          refIds: v.refIds.filter((x): x is string => typeof x === "string"),
        }))
    : [];
  return { version: 1, access, published: !!r.published, items, virtuals };
}


/**
 * Best-effort migration of the older label-signature relationship bag
 * (`scene.meta.relationships`). Labels are resolved to ids where possible;
 * the original bag is left untouched.
 */
function migrateLegacy(scene: GeometryScene): GeometryPropertiesDoc | null {
  const bag = (scene.meta as Record<string, unknown> | undefined)?.relationships as
    | Record<string, unknown>
    | undefined;
  if (!bag || typeof bag !== "object") return null;
  const items: GeometryPropertyItem[] = [];
  let order = 0;
  for (const [signature, list] of Object.entries(bag)) {
    if (signature.startsWith("__") || !Array.isArray(list)) continue;
    const ids = signature
      .split("|")
      .map((part) => part.split(":")[1]?.trim())
      .filter(Boolean)
      .map((label) => idForLabel(scene, label as string))
      .filter((x): x is GeoId => !!x);
    for (const rel of list) {
      const r = rel as { name?: string; formula?: string; applied?: string };
      const content = [r.applied || r.formula, r.name].filter(Boolean).join(" — ");
      if (!content) continue;
      items.push({
        id: newPropertyId(),
        category: r.applied ? "specific" : "general",
        kind: "theorem",
        content,
        sourceObjectIds: ids.slice(0, 1),
        connectedObjectIds: ids,
        approved: true,
        enabled: true,
        order: order++,
      });
    }
  }
  if (items.length === 0) return null;
  return { version: 1, access: "both", published: false, items };
}

function idForLabel(scene: GeometryScene, label: string): GeoId | null {
  const clean = label.replace(/^[∠∡]/, "").trim();
  for (const o of scene.objects) {
    const name = displayName(scene, o);
    if (name === label || name === clean) return o.id;
  }
  return null;
}

/* ───────────── naming diagram objects ───────────── */

export const TYPE_LABEL: Record<string, string> = {
  point: "Point",
  segment: "Segment",
  line: "Line",
  ray: "Ray",
  circle: "Circle",
  arc: "Arc",
  angle: "Angle",
  region: "Area",
  label: "Text",
  curve: "Curve",
};

/**
 * A truthful name for an object. Never invents mathematical labels — falls
 * back to the connected points, then to "Unnamed <type>".
 */
export function displayName(scene: GeometryScene, obj: GeoObject): string {
  const pl = (id: GeoId) => pointById(scene, id)?.label ?? "";
  switch (obj.type) {
    case "point":
      return obj.label || "Unnamed point";
    case "segment":
    case "line":
    case "ray": {
      const a = pl(obj.a), b = pl(obj.b);
      if ((obj as { label?: string }).label) return (obj as { label?: string }).label as string;
      if (a && b) return `${a}${b}`;
      return `Unnamed ${obj.type}`;
    }
    case "circle":
      return obj.label || (pl(obj.center) ? `circle ${pl(obj.center)}` : "Unnamed circle");
    case "arc":
      return pl(obj.center) ? `arc about ${pl(obj.center)}` : "Unnamed arc";
    case "angle": {
      const v = pl(obj.vertex), a = pl(obj.a), b = pl(obj.b);
      if (a && v && b) return `∠${a}${v}${b}`;
      if (v) return `∠${v}`;
      return "Unnamed angle";
    }
    case "region":
      return (obj as { area?: string }).area || "Area";
    case "label":
      return (obj as { text?: string }).text || "Text";
    default:
      return `Unnamed ${(obj as { type: string }).type}`;
  }
}

export function describeObject(
  scene: GeometryScene,
  rawId: GeoId,
): { id: GeoId; type: string; typeLabel: string; name: string } | null {
  const baseId = rawId.split("#")[0];
  const obj = scene.objects.find((o) => o.id === baseId);
  if (!obj) return null;
  return {
    id: baseId,
    type: obj.type,
    typeLabel: TYPE_LABEL[obj.type] ?? obj.type,
    name: displayName(scene, obj),
  };
}

/* ───────────── validation ───────────── */

export interface PropertyIssue {
  itemId: string;
  message: string;
}

export function validateProperties(
  scene: GeometryScene,
  doc: GeometryPropertiesDoc,
): PropertyIssue[] {
  const alive = new Set([
    ...scene.objects.map((o) => o.id),
    ...(doc.virtuals ?? []).map((v) => v.id),
  ]);
  const issues: PropertyIssue[] = [];
  for (const item of doc.items) {
    if (item.enabled === false) continue;
    const missingSource = item.sourceObjectIds.filter((id) => !alive.has(id.split("#")[0]));
    const missingConnected = item.connectedObjectIds.filter((id) => !alive.has(id.split("#")[0]));
    if (item.connectedObjectIds.length === 0) {
      issues.push({ itemId: item.id, message: "No diagram object is connected." });
    }
    if (missingSource.length) {
      issues.push({ itemId: item.id, message: "Its source object was deleted from the diagram." });
    }
    if (missingConnected.length) {
      issues.push({
        itemId: item.id,
        message: `${missingConnected.length} connected object${missingConnected.length === 1 ? " was" : "s were"} deleted from the diagram.`,
      });
    }
    if (!item.approved) {
      issues.push({ itemId: item.id, message: "AI suggestion is not approved yet." });
    }
  }
  return issues;
}

/** Items whose source or connections include this object. */
export function itemsForObject(
  doc: GeometryPropertiesDoc,
  objectId: GeoId,
): GeometryPropertyItem[] {
  const base = objectId.split("#")[0];
  return doc.items
    .filter(
      (i) =>
        i.sourceObjectIds.some((x) => x.split("#")[0] === base) ||
        i.connectedObjectIds.some((x) => x.split("#")[0] === base),
    )
    .sort((a, b) => a.order - b.order);
}

/** What a student is allowed to see. */
export function publishedItemsForObject(
  doc: GeometryPropertiesDoc,
  objectId: GeoId,
): GeometryPropertyItem[] {
  if (doc.access === "off" || !doc.published) return [];
  return itemsForObject(doc, objectId).filter((i) => {
    if (i.enabled === false || i.approved === false) return false;
    if (doc.access === "specific") return i.category === "specific";
    if (doc.access === "general") return i.category === "general";
    return true;
  });
}

export function hasPublishedGuide(doc: GeometryPropertiesDoc): boolean {
  return (
    !!doc.published &&
    doc.access !== "off" &&
    doc.items.some((i) => i.enabled !== false && i.approved !== false)
  );
}

/* ───────────── symbol tokens inside relationship text ───────────── */

const TOKEN_RE = /[A-Za-z]{1,3}|[α-ωΑ-Ω]|∠[A-Za-z]{1,3}/g;
const TOKEN_STOPWORDS = new Set([
  "sin", "cos", "tan", "log", "ln", "and", "the", "is", "of", "so", "if",
  "cot", "sec", "csc", "for", "to", "in", "on", "at", "by", "as", "or",
]);

/** Symbols a teacher can bind to diagram objects, in first-appearance order. */
export function detectTokens(content: string): string[] {
  const out: string[] = [];
  for (const m of content.match(TOKEN_RE) ?? []) {
    const t = m.trim();
    if (!t || TOKEN_STOPWORDS.has(t.toLowerCase())) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 12);
}

/** Every object referenced by a relationship (bindings + explicit picks). */
export function connectionsOf(item: GeometryPropertyItem): GeoId[] {
  return [
    ...new Set([
      ...item.connectedObjectIds,
      ...(item.tokens ?? []).map((t) => t.objectId),
    ]),
  ];
}
