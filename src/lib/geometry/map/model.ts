// Geometry Map — the mathematical principles ACTUALLY used by the solution
// that was generated for this question, in solution order, each one linked to
// the exact diagram objects it applies to.
//
// Pipeline: Question → Diagram → Solution → extract principles → MAP.
// The map is never generated from the diagram alone, never contains the
// numerical answers, and never edits the diagram: object references are stable
// scene ids, so clicking a map item only paints a highlight.

import type { GeoId, GeometryScene } from "@/lib/geometry/scene";
import { describeObject, displayName, TYPE_LABEL } from "@/lib/geometry/properties/model";

export interface GeometryMapItem {
  id: string;
  order: number;
  /** "Angles in the Same Segment", "Cosine Rule", … — ONE principle per item. */
  principle: string;
  /** Symbolic relationship only: "∠ABC = ∠ADC". Never a numeric answer. */
  relation: string;
  /** One line of theory: why the principle holds. */
  explanation: string;
  /** "Used to find BC" — symbolic, never the value found. */
  usedTo: string;
  /** Which step of the solution used it (1-based). */
  stepIndex: number;
  /** What this step establishes, symbolically ("BC", "∠BDC"). */
  producesToken?: string;
  /** What it consumed from earlier steps. */
  needsTokens?: string[];
  /** Exact diagram objects that glow when the item is clicked. */
  objectIds: GeoId[];
  /**
   * Every reference inserted from the diagram: the text it was written as and
   * the stable id it belongs to. The LINK lives on the id, so renaming or
   * clearing the label on the diagram never breaks the property.
   */
  tokens?: MapTokenBinding[];
  /** Optional wording shown on the Smartboard instead of the relation. */
  boardText?: string;
  source: "ai" | "teacher";
  enabled: boolean;
}

export interface MapTokenBinding {
  /** The text as it appears inside the relation, e.g. "AB", "∠ABC". */
  token: string;
  objectId: GeoId;
}

export interface GeometryMapDoc {
  version: 2;
  published: boolean;
  /** True when the items came from analysing a generated solution. */
  generatedFromSolution: boolean;
  /** Permanent binding: the `sectionId` of the question this map belongs to. */
  questionId?: string | null;
  /** Fingerprint of the solution the map was built from — drives staleness. */
  solutionHash?: string;
  generatedAt?: string;
  items: GeometryMapItem[];
  /**
   * Review colour per DIAGRAM OBJECT id. The colour belongs to the geometry,
   * so the object, its label and every property term that references it are
   * painted the same — even after the label text changes.
   */
  colors?: Record<GeoId, string>;
}

/** Teacher palette for object colouring. */
export const OBJECT_COLORS: { name: string; value: string }[] = [
  { name: "Ink", value: "#0f172a" },
  { name: "Blue", value: "#2563eb" },
  { name: "Red", value: "#e11d48" },
  { name: "Green", value: "#059669" },
  { name: "Amber", value: "#d97706" },
  { name: "Purple", value: "#7c3aed" },
];

export type MapStatus = "none" | "ready" | "stale";

/**
 * A stored map is only "ready" while it still belongs to the current question
 * and the current solution text. Anything else is out of date.
 */
export function mapStatus(
  doc: GeometryMapDoc,
  ctx: { questionId?: string | null; solutionHash?: string },
): MapStatus {
  if (doc.items.length === 0) return "none";
  if (!doc.generatedFromSolution) return "ready";
  if (doc.questionId && ctx.questionId && doc.questionId !== ctx.questionId) return "stale";
  if (doc.solutionHash && ctx.solutionHash && doc.solutionHash !== ctx.solutionHash) return "stale";
  return "ready";
}

export const EMPTY_MAP: GeometryMapDoc = {
  version: 2,
  published: false,
  generatedFromSolution: false,
  items: [],
};


export function newMapItemId(): string {
  return `gm_${Math.random().toString(36).slice(2, 10)}`;
}

/* ───────────── no numbers in the map ───────────── */

/** Angle constants that are part of the theory, not of the answer. */
const KEEP_VALUES = new Set(["180", "90", "360", "270", "45", "60", "30"]);
const UNIT = "(?:°|deg|cm|mm|m|km|in|ft|units?)";

/**
 * Strips the solution's numeric answers while keeping the theory intact:
 * measured values ("40°", "10 cm", "8.4"), but NOT structural constants
 * (180°, 90°) and NOT formula coefficients (the 2 in 2(AB)(AC)cos A).
 */
export function stripNumericAnswers(text: string): string {
  if (!text) return "";
  let out = text
    // value with a unit — "10 cm", "40°", "8.4 cm"
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT}`, "gi"), (m, n: string) =>
      KEEP_VALUES.has(n) ? m : "",
    )
    // bare decimals are always measurements
    .replace(/\b\d+\.\d+\b/g, "")
    // approximation noise left behind
    .replace(/\b(?:approx\.?|approximately|about)\b\s*/gi, "");
  // tidy: dangling operators, empty brackets, doubled spaces
  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([=+\-−×÷,])\s*$/g, "")
    .replace(/^\s*([=+×÷,])\s*/g, "")
    .trim();
  return out;
}

/* ───────────── reading / writing on the scene ───────────── */

export function readMap(scene: GeometryScene): GeometryMapDoc {
  const raw = (scene.meta as Record<string, unknown> | undefined)?.geometryMap;
  const doc = sanitizeMap(raw);
  if (doc) return doc;
  return carryLegacy(scene) ?? EMPTY_MAP;
}

export function writeMap(scene: GeometryScene, doc: GeometryMapDoc): GeometryScene {
  return { ...scene, meta: { ...(scene.meta ?? {}), geometryMap: doc } };
}

function sanitizeMap(raw: unknown): GeometryMapDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GeometryMapDoc>;
  if (!Array.isArray(r.items)) return null;
  const items: GeometryMapItem[] = [];
  r.items.forEach((it, i) => {
    if (!it || typeof it !== "object") return;
    const item = it as Partial<GeometryMapItem>;
    const principle = typeof item.principle === "string" ? item.principle.trim() : "";
    if (!principle) return;
    items.push({
      id: typeof item.id === "string" ? item.id : newMapItemId(),
      order: typeof item.order === "number" ? item.order : i,
      principle,
      relation: typeof item.relation === "string" ? item.relation : "",
      explanation: typeof item.explanation === "string" ? item.explanation : "",
      usedTo: typeof item.usedTo === "string" ? item.usedTo : "",
      stepIndex: typeof item.stepIndex === "number" ? item.stepIndex : i + 1,
      producesToken:
        typeof item.producesToken === "string" && item.producesToken.trim()
          ? item.producesToken.trim()
          : undefined,
      needsTokens: Array.isArray(item.needsTokens)
        ? item.needsTokens.filter((t): t is string => typeof t === "string" && !!t.trim())
        : undefined,
      objectIds: Array.isArray(item.objectIds)
        ? [...new Set(item.objectIds.filter((x): x is string => typeof x === "string"))]
        : [],
      tokens: Array.isArray(item.tokens)
        ? (item.tokens as MapTokenBinding[])
            .filter(
              (t) =>
                !!t && typeof t.token === "string" && typeof t.objectId === "string" && !!t.token,
            )
            .map((t) => ({ token: t.token, objectId: t.objectId }))
        : undefined,
      boardText:
        typeof item.boardText === "string" && item.boardText.trim()
          ? item.boardText.trim()
          : undefined,
      source: item.source === "teacher" ? "teacher" : "ai",
      enabled: item.enabled !== false,
    });
  });
  const colors: Record<GeoId, string> = {};
  if (r.colors && typeof r.colors === "object") {
    for (const [id, value] of Object.entries(r.colors as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) colors[id] = value;
    }
  }
  return {
    ...(Object.keys(colors).length ? { colors } : {}),
    version: 2,
    published: !!r.published,
    generatedFromSolution: !!r.generatedFromSolution,
    ...(typeof r.questionId === "string" && r.questionId ? { questionId: r.questionId } : {}),
    ...(typeof r.solutionHash === "string" && r.solutionHash
      ? { solutionHash: r.solutionHash }
      : {}),
    ...(typeof r.generatedAt === "string" ? { generatedAt: r.generatedAt } : {}),
    items: items.sort((a, b) => a.order - b.order).map((it, i) => ({ ...it, order: i })),
  };
}

/**
 * Notes authored under the retired Specific/General relationship system keep
 * their content: each old item becomes an unordered teacher map item. The old
 * `category`, `virtuals` and 4-way access setting are dropped.
 */
function carryLegacy(scene: GeometryScene): GeometryMapDoc | null {
  const legacy = (scene.meta as Record<string, unknown> | undefined)?.geometryProperties as
    | { items?: unknown[]; published?: boolean }
    | undefined;
  if (!legacy || !Array.isArray(legacy.items) || legacy.items.length === 0) return null;
  const items: GeometryMapItem[] = [];
  legacy.items.forEach((raw, i) => {
    const it = raw as {
      content?: string; reason?: string; kind?: string;
      sourceObjectIds?: string[]; connectedObjectIds?: string[]; enabled?: boolean;
    };
    const content = typeof it?.content === "string" ? it.content.trim() : "";
    if (!content) return;
    items.push({
      id: newMapItemId(),
      order: i,
      principle: (it.reason || content).slice(0, 80),
      relation: stripNumericAnswers(content),
      explanation: "",
      usedTo: "",
      stepIndex: i + 1,
      objectIds: [
        ...new Set([...(it.sourceObjectIds ?? []), ...(it.connectedObjectIds ?? [])]),
      ].map((x) => x.split("#")[0]),
      source: "teacher",
      enabled: it.enabled !== false,
    });
  });
  if (!items.length) return null;
  return { version: 2, published: !!legacy.published, generatedFromSolution: false, items };
}

/* ───────────── ordering helpers ───────────── */

export function reorderMap(doc: GeometryMapDoc, id: string, dir: -1 | 1): GeometryMapDoc {
  const items = [...doc.items].sort((a, b) => a.order - b.order);
  const i = items.findIndex((it) => it.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return doc;
  [items[i], items[j]] = [items[j], items[i]];
  return { ...doc, items: items.map((it, k) => ({ ...it, order: k })) };
}

export function upsertMapItem(doc: GeometryMapDoc, item: GeometryMapItem): GeometryMapDoc {
  const exists = doc.items.some((i) => i.id === item.id);
  const items = exists
    ? doc.items.map((i) => (i.id === item.id ? item : i))
    : [...doc.items, { ...item, order: doc.items.length }];
  return { ...doc, items: items.sort((a, b) => a.order - b.order) };
}

export function removeMapItem(doc: GeometryMapDoc, id: string): GeometryMapDoc {
  return {
    ...doc,
    items: doc.items.filter((i) => i.id !== id).map((it, k) => ({ ...it, order: k })),
  };
}

/* ───────────── the pathway ───────────── */

export interface PathwayNode {
  id: string;
  index: number;
  principle: string;
  produces?: string;
  needs?: string[];
}

/** Given → principle → what it produced → next principle → Answer. */
export function pathway(doc: GeometryMapDoc): PathwayNode[] {
  return [...doc.items]
    .filter((i) => i.enabled !== false)
    .sort((a, b) => a.order - b.order)
    .map((i, k) => ({
      id: i.id,
      index: k + 1,
      principle: i.principle,
      produces: i.producesToken,
      needs: i.needsTokens,
    }));
}

/* ───────────── students ───────────── */

export function publishedMapItems(doc: GeometryMapDoc): GeometryMapItem[] {
  if (!doc.published) return [];
  return doc.items
    .filter((i) => i.enabled !== false && i.principle.trim())
    .sort((a, b) => a.order - b.order);
}

export function hasPublishedMap(doc: GeometryMapDoc): boolean {
  return publishedMapItems(doc).length > 0;
}

/* ───────────── diagram objects ───────────── */

/** Only ids that exist in the scene may be stored / highlighted. */
export function keepLiveIds(scene: GeometryScene, ids: GeoId[]): GeoId[] {
  const alive = new Set(scene.objects.map((o) => o.id));
  return [...new Set(ids.map((i) => i.split("#")[0]))].filter((i) => alive.has(i));
}

export function objectChipLabel(scene: GeometryScene, id: GeoId): string {
  const info = describeObject(scene, id);
  return info ? info.name : "missing object";
}

/** Read-only payload handed to the map generator — never AI-invented. */
export function mapInventory(scene: GeometryScene) {
  return scene.objects.map((o) => ({
    id: o.id,
    type: o.type,
    typeLabel: TYPE_LABEL[o.type] ?? o.type,
    name: displayName(scene, o),
  }));
}

/* ───────────── identity-based links ───────────── */

const baseId = (id: string): string => id.split("#")[0];

/**
 * Every diagram object a map item is linked to — its explicit `objectIds`
 * plus the ids behind each token it references. Ids only, never label text.
 */
export function itemObjectIds(item: GeometryMapItem): GeoId[] {
  const ids = [
    ...item.objectIds,
    ...(item.tokens ?? []).map((t) => t.objectId),
  ].map(baseId);
  return [...new Set(ids)];
}

/** Items of THIS diagram linked to THIS object, by identity. */
export function itemsForObject(
  items: GeometryMapItem[],
  objectId: GeoId,
): GeometryMapItem[] {
  const target = baseId(objectId);
  return items.filter((i) => itemObjectIds(i).some((id) => id === target));
}

/** Items an audience is allowed to review on the board. */
export function reviewableMapItems(
  doc: GeometryMapDoc,
  role: "teacher" | "student",
): GeometryMapItem[] {
  const items = [...doc.items]
    .filter((i) => i.enabled !== false && (i.relation.trim() || i.principle.trim()))
    .sort((a, b) => a.order - b.order);
  return role === "teacher" ? items : doc.published ? items : [];
}

/** Object ids in this scene that carry at least one reviewable item. */
export function objectsWithMapItems(
  scene: GeometryScene,
  items: GeometryMapItem[],
): Set<GeoId> {
  const alive = new Set(scene.objects.map((o) => o.id));
  const out = new Set<GeoId>();
  for (const item of items) {
    for (const id of itemObjectIds(item)) if (alive.has(id)) out.add(id);
  }
  return out;
}

/* ───────────── colour belongs to the object ───────────── */

export function objectColor(doc: GeometryMapDoc, id: GeoId): string | undefined {
  return doc.colors?.[baseId(id)];
}

export function setObjectColor(
  doc: GeometryMapDoc,
  id: GeoId,
  color: string | null,
): GeometryMapDoc {
  const next = { ...(doc.colors ?? {}) };
  if (color) next[baseId(id)] = color;
  else delete next[baseId(id)];
  return { ...doc, colors: next };
}

/** The colours a label should inherit: the object it annotates owns them. */
export function labelOwnerColor(
  doc: GeometryMapDoc,
  label: { id: GeoId; ownerId?: GeoId },
): string | undefined {
  return objectColor(doc, label.ownerId ?? label.id);
}
