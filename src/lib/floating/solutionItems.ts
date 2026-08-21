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
}

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
    });
  }
  return out;
};
