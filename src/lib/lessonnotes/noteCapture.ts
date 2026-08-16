// Capture — turns a selected region of the live lesson note into slide content.
// The nodes are copied as TipTap JSON, so the mathematics stays real, editable
// mathematics on the slide: no rasterising, no raw syntax, no rescaling.
import type { Editor } from "@tiptap/react";

export interface CaptureRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CapturedContent {
  /** Top-level lesson-note nodes, in document order. */
  nodes: unknown[];
  /** Geometry as fractions of the note sheet (0..1) — the slide page shares
   *  the sheet's coordinate space, so placement keeps the original scale. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const intersects = (a: DOMRect, b: CaptureRect) =>
  a.right > b.left && a.left < b.left + b.width && a.bottom > b.top && a.top < b.top + b.height;

/**
 * Collect every top-level note node whose rendered box overlaps the selection.
 * Returns null when the selection covers no note content (the caller can then
 * fall back to a rasterised screenshot).
 */
export const captureNoteSelection = (
  editor: Editor | null,
  sheetEl: HTMLElement | null,
  rect: CaptureRect,
): CapturedContent | null => {
  if (!editor || !sheetEl) return null;
  const sheetBox = sheetEl.getBoundingClientRect();
  if (!sheetBox.width || !sheetBox.height) return null;

  const nodes: unknown[] = [];
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  const doc = editor.state.doc;
  let pos = 0;
  doc.forEach((child, offset) => {
    pos = offset;
    let dom: Node | null = null;
    try {
      dom = editor.view.nodeDOM(pos) as Node | null;
    } catch {
      dom = null;
    }
    if (!(dom instanceof HTMLElement)) return;
    const box = dom.getBoundingClientRect();
    if (!box.width || !box.height) return;
    if (!intersects(box, rect)) return;
    nodes.push(child.toJSON());
    minLeft = Math.min(minLeft, box.left);
    minTop = Math.min(minTop, box.top);
    maxRight = Math.max(maxRight, box.right);
    maxBottom = Math.max(maxBottom, box.bottom);
  });

  if (!nodes.length) return null;

  const x = (minLeft - sheetBox.left) / sheetBox.width;
  const y = (minTop - sheetBox.top) / sheetBox.height;
  const w = (maxRight - minLeft) / sheetBox.width;
  const h = (maxBottom - minTop) / sheetBox.height;

  return {
    nodes,
    x: Math.max(0, Math.min(0.98, x)),
    y: Math.max(0, Math.min(0.98, y)),
    w: Math.max(0.05, Math.min(1 - Math.max(0, x), w)),
    h: Math.max(0.03, Math.min(1 - Math.max(0, y), h)),
  };
};
