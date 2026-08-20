// Session layout guard — sessions never overlap other sessions.
//
// A session that the teacher moved lives in an absolutely positioned
// `canvasFrame`, so the page flow cannot see how tall it is. Two measured (never
// hard-coded) rules keep the page readable:
//
//  1. Reserved flow space: the invisible `sessionSpacer` left behind where the
//     session came from is kept exactly as tall as the frame really is. Because
//     the spacer is normal flow content, every session below it is pushed down
//     by the browser itself and the effect cascades naturally through
//     Session 2, 3, 4 … whenever content is added or AI generates a solution.
//  2. Frame-to-frame collision: if a session frame grows into the session frame
//     below it, the lower one — and then the next, and the next — is pushed down
//     by the exact deficit plus a small gap. The session that grew stays put.
//
// Diagram frames are deliberately excluded: a diagram is a free object and may
// overlap a session, exactly as specified.

import type { Editor } from "@tiptap/react";
import { editorZoom, isObjectDragging } from "./objectDrag";

/** Breathing room kept between two sessions. */
const GAP = 18;
/** Ignore sub-pixel noise so the guard never loops on itself. */
const EPS = 3;

interface FrameBox {
  pos: number;
  y: number;
  h: number;
  spacerId: string | null;
}

function collectSessionFrames(editor: Editor): FrameBox[] {
  const z = editorZoom(editor);
  const out: FrameBox[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "canvasFrame") return true;
    // Diagrams are free objects — they never take part in session spacing.
    if (node.attrs.objectKind === "diagram") return false;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    const h = dom ? dom.getBoundingClientRect().height / (z || 1) : 0;
    out.push({
      pos,
      y: Number(node.attrs.y) || 0,
      h,
      spacerId: (node.attrs.spacerId as string | null) ?? null,
    });
    return false;
  });
  return out.sort((a, b) => a.y - b.y);
}

/** One silent pass: sync reserved space, then push overlapping sessions down. */
export function runSessionLayout(editor: Editor) {
  if (!editor || editor.isDestroyed || isObjectDragging()) return;
  const frames = collectSessionFrames(editor);
  if (!frames.length) return;

  // Reserved height per spacer id, from the frame's real measured height.
  const reserve = new Map<string, number>();
  for (const f of frames) {
    if (f.spacerId) reserve.set(f.spacerId, Math.round(f.h + GAP));
  }

  // Cascading push: keep every session below the one above it.
  const nextY = new Map<number, number>();
  let floor: number | null = null;
  for (const f of frames) {
    let y = f.y;
    if (floor != null && y < floor - EPS) y = floor;
    if (Math.abs(y - f.y) > EPS) nextY.set(f.pos, y);
    floor = y + f.h + GAP;
  }

  const tr = editor.state.tr;
  let changed = false;

  tr.doc.descendants((node, pos) => {
    if (node.type.name === "sessionSpacer") {
      const id = node.attrs.spacerId as string | null;
      const want = id ? reserve.get(id) : undefined;
      // A spacer whose frame is gone stops reserving room.
      const target = want ?? 0;
      if (Math.abs((Number(node.attrs.h) || 0) - target) > EPS) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, h: target });
        changed = true;
      }
      return false;
    }
    if (node.type.name === "canvasFrame") {
      const y = nextY.get(pos);
      if (y != null) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, y: Math.round(Math.max(0, y)) });
        changed = true;
      }
      return false;
    }
    return true;
  });

  if (!changed) return;
  // Layout housekeeping is never an Undo step for the teacher.
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/**
 * Keep the guard running for the lifetime of an editor: after document changes
 * (typing, AI generation, a new diagram) and after any size change of a session
 * frame. Returns a disposer.
 *
 * The guard writes transactions, and those transactions (plus the resulting
 * resizes) call it again. To make a feedback loop impossible it converges in a
 * bounded number of passes: after MAX_PASSES consecutive self-triggered passes
 * it stops rescheduling until the teacher's next real edit or resize, so it can
 * never occupy the main thread and freeze the workspace.
 */
const MAX_PASSES = 6;
/** Quiet window after which a burst of passes is considered a fresh change. */
const BURST_RESET_MS = 400;

export function attachSessionLayout(editor: Editor): () => void {
  let raf = 0;
  let passes = 0;
  let lastPassAt = 0;

  const schedule = () => {
    if (raf) return;
    const now = Date.now();
    if (now - lastPassAt > BURST_RESET_MS) passes = 0;
    if (passes >= MAX_PASSES) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      passes += 1;
      lastPassAt = Date.now();
      try { runSessionLayout(editor); } catch { /* layout must never break editing */ }
    });
  };

  const observer = new ResizeObserver(schedule);
  const observed = new Set<Element>();
  const observeFrames = () => {
    // The editor view can be absent (not yet mounted, or already destroyed);
    // layout housekeeping must never throw in that window.
    if (editor.isDestroyed || !editor.view?.dom) return;
    const root = editor.view.dom as HTMLElement;
    root.querySelectorAll("[data-canvas-frame]").forEach((el) => {
      if (el.getAttribute("data-object-kind") === "diagram") return;
      if (observed.has(el)) return;
      observed.add(el);
      observer.observe(el);
    });
  };

  const onTransaction = () => { observeFrames(); schedule(); };
  // A real edit by the teacher always earns a fresh budget of passes.
  const onUpdate = () => { passes = 0; };
  editor.on("transaction", onTransaction);
  editor.on("update", onUpdate);
  observeFrames();
  schedule();

  return () => {
    editor.off("transaction", onTransaction);
    editor.off("update", onUpdate);
    observer.disconnect();
    observed.clear();
    if (raf) window.cancelAnimationFrame(raf);
  };
}
