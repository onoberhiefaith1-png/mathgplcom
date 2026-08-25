// Solution item stream — text lines + first-class objects (tables, diagrams).
//
// The Highlighting Page used to see only text: every table / chart / geometry
// diagram / 3D scene was flattened away when the note was synced. The sync
// layer now also captures those nodes, and this module is the shared
// vocabulary for describing them.
//
// Object detection is GENERIC: anything in a solution that is not text,
// paragraph, heading, list or math is an object. No allow-list of table or
// diagram types exists anywhere, so future assets are supported automatically.

import { TABLES } from "@/lib/lessonnotes/assets/tables";

export type ObjectFamily = "table" | "diagram" | "object";

export interface SolutionObject {
  /** Stable within a solution: `<nodeType>#<ordinal>`. */
  objId: string;
  nodeType: string;
  family: ObjectFamily;
  label: string;
  attrs: Record<string, any>;
  /** Number of text lines that precede this object in the solution. */
  afterLine: number;
  /** True when the node is an inline node and must be wrapped to render. */
  inline?: boolean;
  /** True when this object lives inside a Solution session. */
  inSolution?: boolean;
  /** False only for 2D/3D geometry inside a Solution: the object stays in the
   *  lesson note but is excluded from the student Smartboard guide. */
  presentOnBoard?: boolean;
  /** Which architectural layer owns this object.
   *  "solution" → mathematical working, highlightable / floating-capable.
   *  "notes"    → explanatory / supporting content (ALL diagrams live here). */
  layer?: "solution" | "notes";
  /** False for every diagram: it can never become a Floating Number chip. */
  floatable?: boolean;
  /** Persistent diagram identity carried from the lesson-note node. */
  diagramId?: string | null;
  /** PLACEMENT HOME — the segment this object lives in, recorded once when
   *  the note is parsed so the Smartboard never has to re-derive it:
   *  `<segmentIndex>:<kind>:<ordinal>` e.g. "3:example:2". */
  sectionKey?: string | null;
  /** Human label of the owning session ("Example 2", "Introduction"). */
  sectionLabel?: string | null;
  /** Zero-based position of this object among the objects of its session. */
  sectionOrdinal?: number;
  /** Document order of the owning session in the lesson note. */
  sectionIndex?: number;
}

/** PLACEMENT LAW: objects render in the order
 *  (owning session → position inside that session → line they follow).
 *  Legacy records without a home fall back to their saved order. */
export const compareObjectPlacement = (a: SolutionObject, b: SolutionObject): number => {
  const ai = Number.isFinite(a.sectionIndex as number) ? (a.sectionIndex as number) : Number.MAX_SAFE_INTEGER;
  const bi = Number.isFinite(b.sectionIndex as number) ? (b.sectionIndex as number) : Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  const al = a.afterLine ?? 0;
  const bl = b.afterLine ?? 0;
  if (al !== bl) return al - bl;
  const ao = Number.isFinite(a.sectionOrdinal as number) ? (a.sectionOrdinal as number) : 0;
  const bo = Number.isFinite(b.sectionOrdinal as number) ? (b.sectionOrdinal as number) : 0;
  return ao - bo;
};

/** Stable placement sort (never mutates the input). */
export const sortByPlacement = (objects: SolutionObject[]): SolutionObject[] =>
  [...(objects ?? [])].sort(compareObjectPlacement);

/** Node types that carry prose / equations — never objects. */
const TEXTUAL = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "mathInline",
  "mathBlock",
  "mathSlot",
  "mathStructure",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "solutionRow",
  "solutionMath",
  "solutionProse",
]);

/** Inline nodes that still count as objects (asset-library visuals). */
export const INLINE_OBJECT_TYPES = new Set(["mathVisual", "mathObject"]);

export const isObjectNodeType = (type?: string | null): boolean =>
  !!type && !TEXTUAL.has(type);

/** Known diagram-ish node types. Anything unknown falls back to "object" so a
 *  future asset is still recognised, just with a neutral label. */
const DIAGRAM_TYPES = new Set([
  "geometryDiagram",
  "scene3dDiagram",
  "smartGraph",
  "mathVisual",
  "mathObject",
  "stepAnimation",
  "image",
]);

/** Ids of every asset in the Tables category ("smarttable", "placeValueChart",
 *  "divisionLadder", …). Asset-library visuals are inserted as generic
 *  `mathVisual` nodes whose real identity lives in `attrs.family`, so the node
 *  type alone never reveals that they are tables. */
const TABLE_ASSET_IDS = new Set(
  TABLES.map((t) => String(t.id ?? "").toLowerCase()).filter(Boolean),
);

/** Asset-library visuals nest their real attributes one level deep. */
export const flattenObjectAttrs = (attrs: Record<string, any> = {}): Record<string, any> => {
  const inner = attrs?.attrs && typeof attrs.attrs === "object" ? attrs.attrs : {};
  return { ...attrs, ...inner };
};

const looksLikeTable = (nodeType: string, attrs: Record<string, any>): boolean => {
  if (/table/i.test(nodeType)) return true;
  const flat = flattenObjectAttrs(attrs);
  const hints = [
    attrs?.family,
    flat?.family,
    flat?.visual,
    flat?.kind,
    flat?.variant,
    flat?.assetKind,
    flat?.type,
  ];
  return hints.some((h) => {
    if (typeof h !== "string" || !h) return false;
    return /table/i.test(h) || TABLE_ASSET_IDS.has(h.toLowerCase());
  });
};

export const objectFamily = (nodeType: string, attrs: Record<string, any> = {}): ObjectFamily => {
  if (looksLikeTable(nodeType, attrs)) return "table";
  if (DIAGRAM_TYPES.has(nodeType)) return "diagram";
  if (/diagram|graph|chart|scene|shape|geometry|plot/i.test(nodeType)) return "diagram";
  return "object";
};


/** DIAGRAM LAW: a diagram is Notes-layer content. It is never highlightable,
 *  never a Floating Number, never part of the mathematical floating sequence —
 *  regardless of whether it sits inside or outside a Solution. */
export const isDiagramFamily = (family: ObjectFamily): boolean => family === "diagram";

export const isFloatableObject = (
  o: Pick<SolutionObject, "family" | "floatable">,
): boolean => o.floatable === false ? false : !isDiagramFamily(o.family);

/** Layer an object belongs to, derived from its own nature and location. */
export const objectLayer = (
  family: ObjectFamily,
  inSolution: boolean,
): "solution" | "notes" =>
  isDiagramFamily(family) ? "notes" : inSolution ? "solution" : "notes";

export const familyLabel = (family: ObjectFamily): string =>
  family === "table" ? "Table" : family === "diagram" ? "Diagram" : "Object";

export type SolutionItem =
  | { kind: "text"; line: string; index: number }
  | { kind: "object"; object: SolutionObject };

/** Interleave text lines and captured objects in document order. */
export const buildSolutionItems = (
  lines: string[],
  objects: SolutionObject[],
): SolutionItem[] => {
  const items: SolutionItem[] = [];
  const sorted = [...(objects ?? [])].sort((a, b) => a.afterLine - b.afterLine);
  let oi = 0;
  const drain = (upTo: number) => {
    while (oi < sorted.length && sorted[oi].afterLine <= upTo) {
      items.push({ kind: "object", object: sorted[oi++] });
    }
  };
  for (let i = 0; i < lines.length; i++) {
    drain(i);
    items.push({ kind: "text", line: lines[i], index: i });
  }
  drain(Number.MAX_SAFE_INTEGER);
  return items;
};

/** Read the objects saved on a solution block's `content_json`. */
export const readSolutionObjects = (contentJson: any): SolutionObject[] => {
  const raw = Array.isArray(contentJson?.objects) ? contentJson.objects : [];
  const out: SolutionObject[] = [];
  for (const o of raw) {
    const nodeType = String(o?.nodeType ?? "");
    if (!nodeType) continue;
    const attrs = (o?.attrs && typeof o.attrs === "object") ? o.attrs : {};
    // Recompute the family from the node itself: highlights saved before
    // asset-library tables were recognised carry a stale "diagram" family.
    const family = objectFamily(nodeType, attrs);
    const savedLabel = String(o?.label ?? "");
    const label = savedLabel && savedLabel !== "Diagram" && savedLabel !== "Object"
      ? savedLabel
      : familyLabel(family);
    out.push({
      objId: String(o?.objId ?? `${nodeType}#0`),
      nodeType,
      family,
      label,

      attrs,
      afterLine: Number(o?.afterLine) || 0,
      inline: o?.inline === true,
      inSolution: o?.inSolution === true,
      presentOnBoard: o?.presentOnBoard !== false,
      // Layer / floatability are DERIVED, never trusted from old records, so
      // legacy diagram highlights stop behaving like floating content.
      layer: objectLayer(family, o?.inSolution === true),
      floatable: !isDiagramFamily(family),
      diagramId: typeof (attrs as any)?.diagramId === "string" ? (attrs as any).diagramId : null,
      // Placement home survives every re-save; legacy rows simply have none.
      sectionKey: typeof o?.sectionKey === "string" ? o.sectionKey : null,
      sectionLabel: typeof o?.sectionLabel === "string" ? o.sectionLabel : null,
      sectionOrdinal: Number.isFinite(Number(o?.sectionOrdinal)) ? Number(o.sectionOrdinal) : undefined,
      sectionIndex: Number.isFinite(Number(o?.sectionIndex)) ? Number(o.sectionIndex) : undefined,
    });
  }
  return out;
};

/** NOTE-ATTACHMENT LAW (diagrams).
 *
 *  A diagram is Notes-layer content: it can never be highlighted and never
 *  becomes a Floating Number. Instead it rides the NOTE of the entry ABOVE it,
 *  exactly like unhighlighted prose. A diagram that precedes every entry has no
 *  parent, so it becomes a standalone note-only entry.
 *
 *  `entries` must be in document order and expose their document position.
 *  The caller decides what a "leading" entry looks like — this helper only
 *  reports the assignment. */
export const assignNoteObjects = <T,>(
  entries: Array<{ entry: T; pos: number }>,
  objects: SolutionObject[],
): { byIndex: Map<number, SolutionObject[]>; leading: SolutionObject[] } => {
  const byIndex = new Map<number, SolutionObject[]>();
  const leading: SolutionObject[] = [];
  const noteObjects = (objects ?? [])
    .filter((o) => !isFloatableObject(o))
    .sort(compareObjectPlacement);
  for (const object of noteObjects) {
    // The object sits immediately BEFORE its `afterLine`.
    const pos = object.afterLine - 0.5;
    let owner = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].pos <= pos) owner = i;
      else break;
    }
    if (owner < 0) {
      leading.push(object);
      continue;
    }
    byIndex.set(owner, [...(byIndex.get(owner) ?? []), object]);
  }
  return { byIndex, leading };
};
