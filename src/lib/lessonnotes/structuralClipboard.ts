// Structural clipboard for Lesson Notes maths.
//
// A mathematical expression is a real ProseMirror object tree (one
// `mathStructure` node with a `kind`/`attrs` and one `mathSlot` per cell,
// nested arbitrarily). Copying it must move that OBJECT, never the visible
// digits: a copied 2×2 matrix has to paste back as a 2×2 matrix whose four
// cells are still independently editable.
//
// The clipboard therefore carries two flavours:
//   • text/html  — the schema's own markup (data-math-structure / data-kind /
//                  data-attrs / data-math-slot). This is what paste reads.
//   • text/plain — a readable value so pasting into other apps still works.
//
// Nothing here renders or validates maths; it only serialises and parses.

import { DOMParser as PMDOMParser, DOMSerializer, Slice } from "@tiptap/pm/model";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

/** Marker attribute so a paste can recognise our own structural payload. */
export const STRUCTURAL_FLAG = "data-mathgpl-structural";

const STRUCTURE = "mathStructure";

/** Deepest→outermost: the boundaries of the outermost `mathStructure`
 *  containing `pos`, or null when `pos` sits in ordinary content. */
const structureRangeAt = (doc: PMNode, pos: number): { from: number; to: number } | null => {
  let $p;
  try { $p = doc.resolve(pos); } catch { return null; }
  for (let d = 1; d <= $p.depth; d++) {
    if ($p.node(d).type.name === STRUCTURE) {
      // Outermost wins, so return on the FIRST (shallowest) match.
      return { from: $p.before(d), to: $p.after(d) };
    }
  }
  return null;
};

/** Grow a range outward until neither end cuts through a mathematical
 *  structure. Selecting one matrix cell copies the whole matrix; selecting
 *  inside √(y/6) copies the whole radical with its fraction. Ranges that
 *  touch no maths are returned unchanged. */
export const expandSelectionToStructures = (
  state: EditorState,
  from: number,
  to: number,
): { from: number; to: number } => {
  let a = from;
  let b = to;
  for (let guard = 0; guard < 20; guard++) {
    const left = structureRangeAt(state.doc, a);
    const right = structureRangeAt(state.doc, b);
    const nextA = left ? Math.min(a, left.from) : a;
    const nextB = right ? Math.max(b, right.to) : b;
    if (nextA === a && nextB === b) break;
    a = nextA;
    b = nextB;
  }
  return { from: a, to: b };
};

/** Readable plain-text fallback (maths leaves contribute their value). */
export const rangeToPlainText = (state: EditorState, from: number, to: number): string =>
  state.doc.textBetween(from, to, "\n", (leaf: PMNode) => {
    const v = (leaf.attrs as { value?: unknown } | undefined)?.value;
    return typeof v === "string" && v.length ? v : "";
  });

export interface StructuralPayload {
  html: string;
  text: string;
  /** True when the payload actually contains a mathematical structure. */
  hasStructure: boolean;
}

/** Serialise a document range into a structural clipboard payload. */
export const rangeToStructuralPayload = (
  state: EditorState,
  from: number,
  to: number,
): StructuralPayload => {
  const slice = state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(state.schema);
  const fragment = serializer.serializeFragment(slice.content);
  const holder = document.createElement("div");
  holder.setAttribute(STRUCTURAL_FLAG, "");
  // ProseMirror's own slice metadata: keeps open depths intact so a slice
  // taken from inside a paragraph pastes back inline.
  holder.setAttribute("data-pm-slice", `${slice.openStart} ${slice.openEnd} []`);
  holder.appendChild(fragment);
  const html = holder.outerHTML;
  return {
    html,
    text: rangeToPlainText(state, from, to),
    hasStructure: html.includes("data-math-structure"),
  };
};

/** True when clipboard HTML carries structural maths we can rebuild. */
export const isStructuralHtml = (html: string | null | undefined): boolean =>
  !!html && html.includes("data-math-structure");

/** Parse structural clipboard HTML back into a slice for insertion. */
export const structuralHtmlToSlice = (schema: Schema, html: string): Slice | null => {
  try {
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const source = (holder.querySelector(`[${STRUCTURAL_FLAG}]`) as HTMLElement | null) ?? holder;
    const sliceAttr = source.getAttribute("data-pm-slice");
    const parsed = PMDOMParser.fromSchema(schema).parseSlice(source, {
      preserveWhitespace: true,
    });
    if (!sliceAttr) return parsed;
    const [openStart, openEnd] = sliceAttr.split(" ").map((n) => Number(n));
    if (!Number.isFinite(openStart) || !Number.isFinite(openEnd)) return parsed;
    try {
      return new Slice(parsed.content, openStart, openEnd);
    } catch {
      return parsed;
    }
  } catch {
    return null;
  }
};

/** Write both flavours to the system clipboard. Uses the async Clipboard
 *  API when available and falls back to a synthetic `copy` event, which is
 *  the only route in browsers without `ClipboardItem`. */
export const writeStructuralClipboard = async (payload: StructuralPayload): Promise<boolean> => {
  const { html, text } = payload;
  const nav = navigator as Navigator & { clipboard?: Clipboard };
  const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (nav.clipboard?.write && CI) {
    try {
      await nav.clipboard.write([
        new CI({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      /* fall through to the event-based path */
    }
  }
  try {
    let ok = false;
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("text/html", html);
      e.clipboardData?.setData("text/plain", text);
      ok = true;
    };
    document.addEventListener("copy", onCopy, true);
    document.execCommand("copy");
    document.removeEventListener("copy", onCopy, true);
    if (ok) return true;
  } catch {
    /* noop */
  }
  try {
    await nav.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
};
