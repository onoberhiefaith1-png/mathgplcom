// Container-scoped section boundaries.
//
// A lesson-note section can live in the flowing document body OR inside a
// free-positioned `canvasFrame` / a Solution cell. Because frames are
// absolutely positioned, document order is NOT visual order: walking the whole
// document for "the next heading" can land inside a completely different frame
// (or fall through to the very end of the document), which is why AI-generated
// solutions used to appear above the question or at the bottom of the note.
//
// These helpers keep every boundary computation inside the heading's OWN
// container, so generated content is always enclosed under its heading.

import type { Node as PMNode } from "@tiptap/pm/model";

const FRAME_NODES = new Set(["canvasFrame", "solutionMath", "solutionProse"]);

/** The range of the nearest frame/cell ancestor of `pos`, else the whole doc. */
export function containerRangeFor(
  doc: PMNode,
  pos: number,
): { start: number; end: number; depth: number } {
  try {
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    for (let d = $pos.depth; d > 0; d--) {
      if (FRAME_NODES.has($pos.node(d).type.name)) {
        return { start: $pos.start(d), end: $pos.end(d), depth: d };
      }
    }
  } catch { /* fall through to doc range */ }
  return { start: 0, end: doc.content.size, depth: 0 };
}

/**
 * End of the section owned by the heading at `headingPos`: the next sibling
 * heading of the same-or-higher level WITHIN the same container, otherwise the
 * end of that container's content. Never crosses into another frame and never
 * silently returns the end of the document.
 */
export function sectionEndWithin(doc: PMNode, headingPos: number): number {
  const heading = doc.nodeAt(headingPos);
  if (!heading || heading.type.name !== "heading") return headingPos;
  const level = (heading.attrs as any)?.level ?? 2;
  let $h;
  try {
    $h = doc.resolve(headingPos);
  } catch {
    return headingPos + heading.nodeSize;
  }
  const parent = $h.parent;
  const idx = $h.index();
  let pos = headingPos + heading.nodeSize;
  for (let i = idx + 1; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child.type.name === "heading" && ((child.attrs as any)?.level ?? 6) <= level) return pos;
    pos += child.nodeSize;
  }
  return pos;
}

/** Clamp an insertion position so it stays under `headingPos` and inside its container. */
export function clampInsideSection(doc: PMNode, headingPos: number, pos: number): number {
  const heading = doc.nodeAt(headingPos);
  const min = heading ? headingPos + heading.nodeSize : headingPos;
  const containerEnd = containerRangeFor(doc, headingPos).end;
  const max = Math.min(containerEnd, doc.content.size);
  return Math.max(Math.min(min, max), Math.min(pos, max));
}
