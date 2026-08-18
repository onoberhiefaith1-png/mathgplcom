// Workspace object dragging — the teacher is the final layout controller.
//
// A lesson note is a canvas of objects: the question block, its diagram and
// its solution. Any of them can be lifted out of the flow into its own
// free-positioned `canvasFrame` and parked anywhere on the paper, WITHOUT
// changing its content and without losing its relationship to the question
// (the frame carries `ownerQuestionId`).
//
// Two rules make dragging behave well:
//  1. While the pointer moves we only translate the DOM element (no document
//     transactions), so the drag is smooth and does not flood the history.
//  2. On release we write the final coordinates in ONE transaction that closes
//     the history group — so a completed move is exactly one Undo step.

import type { Editor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";

export type ObjectKind = "solution" | "diagram";

/** Effective zoom of the note body (paper transform), never 0. */
export function editorZoom(editor: Editor): number {
  const dom = editor.view.dom as HTMLElement;
  const rect = dom.getBoundingClientRect();
  const w = dom.offsetWidth || rect.width || 1;
  const z = rect.width / w;
  return Number.isFinite(z) && z > 0.05 ? z : 1;
}

/** Client point → paper-local coordinates (the space `canvasFrame` x/y live in). */
export function paperCoords(editor: Editor, clientX: number, clientY: number) {
  const host = editor.view.dom as HTMLElement;
  const r = host.getBoundingClientRect();
  const z = editorZoom(editor);
  return {
    x: Math.max(0, (clientX - r.left) / z),
    y: Math.max(0, (clientY - r.top) / z),
    z,
  };
}

/** Position of the `canvasFrame` node whose DOM element is `frameEl`, or null. */
export function framePos(editor: Editor, frameEl: HTMLElement): number | null {
  try {
    const pos = editor.view.posAtDOM(frameEl, 0) - 1;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== "canvasFrame") return null;
    return pos;
  } catch {
    return null;
  }
}

/** Write final coordinates onto a frame as a single history entry. */
export function commitFramePosition(editor: Editor, pos: number, x: number, y: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "canvasFrame") return;
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    x: Math.round(Math.max(0, x)),
    y: Math.round(Math.max(0, y)),
  });
  closeHistory(tr);
  editor.view.dispatch(tr);
}

/**
 * Lift the document range [from, to) out of the flow into its own
 * free-positioned frame at paper coordinates (x, y). The content is moved
 * verbatim — nothing is regenerated, re-derived or reformatted.
 * Returns the new frame position, or null.
 */
export function detachIntoFrame(
  editor: Editor,
  from: number,
  to: number,
  x: number,
  y: number,
  attrs: { objectKind: ObjectKind; ownerQuestionId?: string | null; w?: number },
): number | null {
  const doc = editor.state.doc;
  if (to <= from || to > doc.content.size) return null;
  let content: unknown;
  try {
    content = doc.slice(from, to).content.toJSON();
  } catch {
    return null;
  }
  if (!content || !Array.isArray(content) || !content.length) return null;

  const host = editor.view.dom as HTMLElement;
  const avail = Math.max(200, (host.clientWidth || 720) - x - 8);
  const w = Math.round(Math.min(attrs.w ?? 520, avail));

  editor.chain().deleteRange({ from, to }).run();
  const at = editor.state.doc.content.size;
  editor.chain().insertContentAt(at, {
    type: "canvasFrame",
    attrs: {
      x: Math.round(Math.max(0, x)),
      y: Math.round(Math.max(0, y)),
      w,
      objectKind: attrs.objectKind,
      ownerQuestionId: attrs.ownerQuestionId ?? null,
    },
    content: content as Record<string, unknown>[],
  }).run();
  const tr = editor.state.tr;
  closeHistory(tr);
  editor.view.dispatch(tr);
  return at;
}

/** The frame element that directly hosts `el`, if any. */
export function hostFrameElement(el: HTMLElement | null): HTMLElement | null {
  return (el?.closest("[data-canvas-frame]") as HTMLElement | null) ?? null;
}

interface DragOptions {
  /** Called once, when the drag threshold is crossed and the object is not
   *  already inside its own frame. Must return the new frame position. */
  onDetach?: (paper: { x: number; y: number }) => number | null;
  /** DOM element translated for live feedback. */
  ghost: HTMLElement;
  threshold?: number;
}

/**
 * Generic object drag. `frameEl` is the frame already hosting the object, or
 * null when the object still lives in the flow (then `onDetach` lifts it out).
 */
export function startObjectDrag(
  editor: Editor,
  frameEl: HTMLElement | null,
  startX: number,
  startY: number,
  opts: DragOptions,
) {
  const z = editorZoom(editor);
  const threshold = opts.threshold ?? 4;
  let pos = frameEl ? framePos(editor, frameEl) : null;
  let origin = (() => {
    if (pos == null) return null;
    const n = editor.state.doc.nodeAt(pos);
    return n ? { x: Number(n.attrs.x) || 0, y: Number(n.attrs.y) || 0 } : null;
  })();
  let ghost: HTMLElement | null = opts.ghost;
  let started = pos != null;
  let moved = false;
  // Movement already consumed by the detach step, so the object does not jump.
  let base = { dx: 0, dy: 0 };

  const move = (ev: PointerEvent | MouseEvent) => {
    const dx = (ev.clientX - startX) / z;
    const dy = (ev.clientY - startY) / z;
    if (!moved && Math.abs(ev.clientX - startX) < threshold && Math.abs(ev.clientY - startY) < threshold) return;
    moved = true;
    if (!started) {
      // Detach in place: the frame starts exactly where the object already is.
      const r = ghost?.getBoundingClientRect();
      const at = r
        ? paperCoords(editor, r.left, r.top)
        : paperCoords(editor, ev.clientX, ev.clientY);
      const created = opts.onDetach?.({ x: at.x, y: at.y });
      if (created == null) { moved = false; return; }
      pos = created;
      const n = editor.state.doc.nodeAt(pos);
      origin = n ? { x: Number(n.attrs.x) || 0, y: Number(n.attrs.y) || 0 } : { x: at.x, y: at.y };
      started = true;
      base = { dx, dy };
      // The node was re-created, so the old DOM element is gone.
      ghost = (editor.view.nodeDOM(pos) as HTMLElement | null) ?? null;
      return;
    }
    if (ghost) ghost.style.transform = `translate(${dx - base.dx}px, ${dy - base.dy}px)`;
  };

  const up = (ev: PointerEvent | MouseEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (ghost) ghost.style.transform = "";
    if (!moved || pos == null || !origin) return;
    const dx = (ev.clientX - startX) / z - base.dx;
    const dy = (ev.clientY - startY) / z - base.dy;
    commitFramePosition(editor, pos, origin.x + dx, origin.y + dy);
  };


  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
}
