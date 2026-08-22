// LESSON OUTLINE — deterministic session segmentation.
//
// A manually built lesson note is NOT one continuous block of text: it is a
// sequence of sessions, each opened by a structural heading (INTRODUCTION,
// EXAMPLE 1, SOLUTION 1, CLASSWORK, …). This module is the single source of
// truth for where each session STARTS and ENDS.
//
// Rules:
//  - START  = the structural heading itself.
//  - END    = the node immediately before the next structural heading.
//  - Boundaries are always recomputed from the live document, never stored as
//    line numbers, so adding/removing content or inserting a new session
//    between two others re-splits automatically.
//  - Only real structural headings count (see `structuralHeadingKind`).
//    Ordinary paragraphs and descriptive headings are content, never markers.
//  - NO AI is involved. This is pure editor state.

import {
  REPEATABLE_SECTION_KINDS,
  SECTION_LABELS,
  structuralHeadingKind,
  type SectionKind,
} from "@/lib/lessonnotes/sectionKinds";
import {
  familyLabel,
  isDiagramFamily,
  isObjectNodeType,
  objectFamily,
  objectLayer,
  INLINE_OBJECT_TYPES,
  type SolutionObject,
} from "@/lib/floating/solutionItems";

type Node = any;

/** Containers that are pure layout wrappers — their children are real
 *  document content and must take part in segmentation. */
const CONTAINER_TYPES = new Set(["canvasFrame", "pageFrame", "canvasLayer"]);

export const flattenContainers = (nodes: Node[]): Node[] => {
  const out: Node[] = [];
  for (const n of nodes ?? []) {
    if (n && CONTAINER_TYPES.has(String(n.type)) && Array.isArray(n.content)) {
      out.push(...flattenContainers(n.content as Node[]));
    } else if (n) {
      out.push(n);
    }
  }
  return out;
};

/** Visible text of a node, math preserved as its raw value. */
export function nodeText(node: Node): string {
  if (!node) return "";
  if (node.type === "text") return String(node.text ?? "");
  if (node.type === "mathInline" || node.type === "mathBlock") {
    return String(node.attrs?.value ?? "");
  }
  if (Array.isArray(node.content)) return node.content.map(nodeText).join("");
  return "";
}

export interface LessonSegment {
  /** Session kind of the START marker. */
  kind: SectionKind;
  /** Heading text exactly as the teacher sees it. */
  title: string;
  /** 1-based counter per kind ("Example 1", "Example 2"). */
  ordinal: number;
  /** Display label: "Example 1", "Introduction". */
  label: string;
  /** Index of this segment in the outline (document order). */
  index: number;
  /** Heading level of the START marker (0 for the implicit preamble). */
  level: number;
  /** True when this segment is a Solution session. */
  isSolution: boolean;
  /** True when there was no START marker (content before the first heading). */
  implicit: boolean;
  /** Content nodes between START (exclusive) and END (inclusive). */
  nodes: Node[];
}

const isHeadingNode = (n: Node) => n?.type === "heading";

/**
 * Segment a TipTap document JSON into sessions.
 * Repeatable kinds get a running ordinal; a number written on the heading
 * itself ("Example 3") wins so teacher numbering is respected.
 */
export function buildLessonOutline(doc: any): LessonSegment[] {
  const content = flattenContainers(Array.isArray(doc?.content) ? doc.content : []);
  const segments: LessonSegment[] = [];
  const counters = new Map<SectionKind, number>();
  let current: LessonSegment | null = null;

  const open = (
    kind: SectionKind,
    title: string,
    level: number,
    explicitNumber: number | null,
    implicit: boolean,
  ): LessonSegment => {
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    const ordinal = explicitNumber ?? next;
    const base = SECTION_LABELS[kind] ?? title;
    // Repeatable sessions (and Solutions) always read "Example 1", "Solution 2"
    // so the teacher and the Smartboard name the same segment identically.
    const numbered = kind === "solution" || REPEATABLE_SECTION_KINDS.has(kind);
    const label = numbered ? `${base} ${ordinal}` : base;
    const seg: LessonSegment = {
      kind,
      title: title || base,
      ordinal,
      label,
      index: segments.length,
      level,
      isSolution: kind === "solution",
      implicit,
      nodes: [],
    };
    current = seg;
    segments.push(seg);
    return seg;
  };

  for (const node of content) {
    if (isHeadingNode(node)) {
      const level = Number(node.attrs?.level ?? 6);
      const marker = structuralHeadingKind(nodeText(node).trim(), level, node.attrs);
      if (marker) {
        open(marker.kind, marker.title, level, marker.number, false);
        continue;
      }
      // Descriptive heading → ordinary content of the current session.
    }
    const seg = current ?? open("explanation", "", 0, null, true);
    seg.nodes.push(node);
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Content items inside a segment
// ---------------------------------------------------------------------------

/** Collect inline object nodes (asset-library visuals) nested in a block. */
function collectInlineObjects(node: Node, out: Node[]): void {
  if (!node || typeof node !== "object") return;
  if (INLINE_OBJECT_TYPES.has(String(node.type))) { out.push(node); return; }
  if (Array.isArray(node.content)) for (const c of node.content) collectInlineObjects(c, out);
}

/** 2D / 3D geometry node types — the ones excluded from a Solution guide. */
const GEOMETRY_NODE_TYPES = new Set(["geometryDiagram", "scene3dDiagram", "scene3DDiagram"]);

export const isGeometryObject = (nodeType: string): boolean =>
  GEOMETRY_NODE_TYPES.has(nodeType);

/**
 * Render a segment's body into plain text lines PLUS the ordered objects it
 * contains (tables, smart tables, diagrams, 3D scenes, charts, images).
 *
 * `inSolution` drives the LAYER, not deletion:
 *   - Every object records which session it belongs to.
 *   - Diagrams (2D geometry, 3D scenes, graphs, visuals) ALWAYS belong to the
 *     NOTES layer: never highlightable, never a Floating Number — but always
 *     rendered with the note/content block that surrounds them.
 *   - Tables — ordinary, Smart, LCM, statistics — stay in the Solution layer
 *     when they sit inside a Solution, so they remain floating-capable.
 */
export function renderSegmentBody(
  nodes: Node[],
  inSolution = false,
): { text: string; objects: SolutionObject[] } {
  const lines: string[] = [];
  const objects: SolutionObject[] = [];
  const counters = new Map<string, number>();

  const pushObject = (n: Node) => {
    const nodeType = String(n?.type ?? "");
    if (!nodeType) return;
    const attrs = (n?.attrs && typeof n.attrs === "object") ? n.attrs : {};
    const idx = counters.get(nodeType) ?? 0;
    counters.set(nodeType, idx + 1);
    const family = objectFamily(nodeType, attrs);
    const diagram = isDiagramFamily(family);
    const persistentId =
      typeof attrs.diagramId === "string" && attrs.diagramId
        ? attrs.diagramId
        : null;
    objects.push({
      // Persistent identity first: a diagram keeps the SAME objId across
      // edits, re-saves, floating generation and Smartboard renders.
      objId: persistentId ? `${nodeType}#${persistentId}` : `${nodeType}#${idx}`,
      nodeType,
      family,
      label: familyLabel(family),
      attrs,
      afterLine: lines.length,
      inline: INLINE_OBJECT_TYPES.has(nodeType),
      inSolution,
      // A diagram is permanent lesson content: it always travels to the
      // Smartboard with the note group it belongs to. Inside a Solution it is
      // simply routed through the NOTES layer instead of the floating stream.
      presentOnBoard: true,
      layer: objectLayer(family, inSolution),
      floatable: !diagram,
      diagramId: persistentId,
    });
  };

  for (const n of nodes ?? []) {
    if (!n) continue;
    if (isObjectNodeType(n.type)) { pushObject(n); continue; }
    const t = nodeText(n).trim();
    if (t) lines.push(t);
    const inlineObjs: Node[] = [];
    collectInlineObjects(n, inlineObjs);
    for (const o of inlineObjs) pushObject(o);
  }
  return { text: lines.join("\n").trim(), objects };
}

/** Objects that may be shown on the student Smartboard for this segment. */
export const boardObjects = (objects: SolutionObject[]): SolutionObject[] =>
  (objects ?? []).filter((o) => o.presentOnBoard !== false);

/** Notes-layer objects: diagrams and supporting content. They render with the
 *  note/content block, never inside the floating solution stream. */
export const notesLayerObjects = (objects: SolutionObject[]): SolutionObject[] =>
  (objects ?? []).filter((o) => o.presentOnBoard !== false && o.floatable === false);

/** Solution-layer objects: tables and structures that may float. */
export const solutionLayerObjects = (objects: SolutionObject[]): SolutionObject[] =>
  (objects ?? []).filter((o) => o.floatable !== false);
