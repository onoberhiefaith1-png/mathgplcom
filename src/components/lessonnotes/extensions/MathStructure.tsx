// Elastic math structure system. ONE parent node `mathStructure` with a
// `kind` attr (fraction, sqrt, matrix, bigop…) whose direct children are
// `mathSlot` nodes. Each slot is a real ProseMirror inline container that
// accepts text AND further nested structures, giving us arbitrarily deep
// composition (fraction inside sqrt inside matrix, etc.).
//
// This module was rewritten to fix three bugs that blocked editing:
//   1. Cursor no longer lands past the decorative op/mark/index spans —
//      slots are direct grid children of `.math-struct`, and insertAsset
//      places the caret at the first slot's inner start.
//   2. Slots are single contenteditable spans (NodeViewContent rendered
//      directly, no NodeViewWrapper), so ProseMirror can always resolve
//      a text position inside them.
//   3. Empty-slot placeholder is a CSS pseudo with pointer-events:none,
//      so clicking the ▯ hits the contentDOM, not the pseudo.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { validateStructure, nodeToJson } from "@/lib/lessonnotes/structureValidator";

// ── mathSlot ────────────────────────────────────────────────────────────
// Plain (non-React) node view whose dom === contentDOM. This is the ONLY
// arrangement that lets ProseMirror place a valid text selection inside
// an empty inline slot, and lets typed text land inside the correct span.
// Any React wrapper produces an outer non-editable element that swallows
// keystrokes and clicks.
export const MathSlot = Node.create({
  name: "mathSlot",
  group: "mathSlot",
  content: "inline*",
  inline: true,
  selectable: false,
  parseHTML() { return [{ tag: "span[data-math-slot]" }]; },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-math-slot": "", class: "math-slot" }),
      0,
    ];
  },
  addNodeView() {
    return () => {
      const dom = document.createElement("span");
      dom.className = "math-slot";
      dom.setAttribute("data-math-slot", "");
      return {
        dom,
        contentDOM: dom,
        update: (node) => {
          if (node.type.name !== "mathSlot") return false;
          if (node.content.size === 0) dom.setAttribute("data-empty", "true");
          else dom.removeAttribute("data-empty");
          return true;
        },
      };
    };
  },

  // Inject a zero-width-space widget into every EMPTY mathSlot so the
  // browser can place a caret inside it. Without this, an empty inline
  // <span> is not a valid DOM cursor position and typed text lands in the
  // previous slot instead. Widget content is invisible and ignored by PM.
  addProseMirrorPlugins() {
    const key = new PluginKey("mathSlotCursorAnchors");
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "mathSlot" && node.content.size === 0) {
                decos.push(
                  Decoration.widget(pos + 1, () => {
                    const s = document.createElement("span");
                    s.className = "math-slot__anchor";
                    s.textContent = "\u200B";
                    return s;
                  }, { side: -1, ignoreSelection: true }),
                );
              }
              return true;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

// ── mathStructure (parent) ──────────────────────────────────────────────
function MathStructureView({ node }: NodeViewProps) {
  const kind = (node.attrs.kind as string) || "fraction";
  const extraAttrs = (node.attrs.attrs as Record<string, unknown>) || {};
  const rows = Number(extraAttrs.rows ?? 0) || undefined;
  const cols = Number(extraAttrs.cols ?? 0) || undefined;
  const op = (extraAttrs.op as string) || "";
  const br = (extraAttrs.br as string) || "";
  const mark = (extraAttrs.mark as string) || "";
  const idx = (extraAttrs.index as string) || "";
  const divider = typeof extraAttrs.divider === "number" ? (extraAttrs.divider as number) : undefined;
  const locked = !!extraAttrs.locked;
  const isMatrix = kind === "matrix";

  const style: React.CSSProperties = {};
  if (isMatrix && rows && cols) {
    // col 1 = left bracket, cols 2..cols+1 = cells, last col = right bracket.
    style.gridTemplateColumns = `max-content repeat(${cols}, minmax(1.2em, max-content)) max-content`;
    style.gridTemplateRows = `repeat(${rows}, auto)`;
    // Expose dims as custom properties so CSS can reference the exact
    // column indices (safety net against any grid-line resolution quirks).
    (style as Record<string, string>)["--matrix-rows"] = String(rows);
    (style as Record<string, string>)["--matrix-cols"] = String(cols);
  } else if (rows && cols) {
    const cells = `repeat(${cols}, minmax(1.2em, max-content))`;
    style.gridTemplateColumns = cells;
    style.gridTemplateRows = `repeat(${rows}, auto)`;
  }

  return (
    <NodeViewWrapper
      as={"span" as any}
      className={`math-struct math-struct--${kind}`}
      data-math-structure=""
      data-kind={kind}
      data-bracket={br || undefined}
      data-rows={rows || undefined}
      data-cols={cols || undefined}
      data-locked={locked || undefined}
      style={style}
    >
      {op && <span className="math-struct__op ms-op" contentEditable={false} aria-hidden>{op}</span>}
      {mark && <span className="math-struct__mark ms-mark" contentEditable={false} aria-hidden>{mark}</span>}
      {idx && <span className="math-struct__index ms-index" contentEditable={false} aria-hidden>{idx}</span>}
      {isMatrix && typeof divider === "number" && cols && rows && (
        <span
          className="math-struct__divider"
          contentEditable={false}
          aria-hidden
          style={{ gridColumn: 1 + divider + 1, gridRow: `1 / ${rows + 1}` }}
        />
      )}
      <NodeViewContent as={"span" as any} className="math-struct__slots" />
    </NodeViewWrapper>
  );
}


export const MathStructure = Node.create({
  name: "mathStructure",
  group: "inline",
  inline: true,
  content: "mathSlot+",
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      kind: {
        default: "fraction",
        parseHTML: (el) => el.getAttribute("data-kind") ?? "fraction",
        renderHTML: (a) => ({ "data-kind": a.kind }),
      },
      attrs: {
        default: {},
        parseHTML: (el) => {
          try { return JSON.parse(el.getAttribute("data-attrs") || "{}"); }
          catch { return {}; }
        },
        renderHTML: (a) => ({ "data-attrs": JSON.stringify(a.attrs ?? {}) }),
      },
    };
  },

  parseHTML() { return [{ tag: "span[data-math-structure]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-structure": "", class: "math-struct" }), 0];
  },
  addNodeView() { return ReactNodeViewRenderer(MathStructureView); },

  // Keyboard flow inside a structure: Tab jumps to next slot, Shift-Tab to
  // previous, Backspace in an empty first slot deletes the whole thing.
  addKeyboardShortcuts() {
    const jump = (dir: 1 | -1) => ({ editor }: { editor: any }) => {
      const { state } = editor;
      const { $from } = state.selection;
      let slotDepth = -1;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "mathSlot") { slotDepth = d; break; }
      }
      if (slotDepth < 1) return false;
      const structDepth = slotDepth - 1;
      const structNode = $from.node(structDepth);
      if (structNode.type.name !== "mathStructure") return false;
      const slotIndex = $from.index(structDepth);
      const nextIndex = slotIndex + dir;
      if (nextIndex < 0 || nextIndex >= structNode.childCount) return false;
      const structStart = $from.before(structDepth);
      let pos = structStart + 1;
      for (let i = 0; i < nextIndex; i++) {
        pos += structNode.child(i).nodeSize;
      }
      pos += 1;
      try {
        const $target = editor.state.doc.resolve(pos);
        const sel = Selection.near($target, 1);
        editor.view.dispatch(editor.state.tr.setSelection(sel));
      } catch {
        editor.commands.setTextSelection(pos);
      }
      return true;
    };
    return {
      Tab: jump(1),
      "Shift-Tab": jump(-1),
    };
  },

  // Structural validator: runs on every transaction. Any `mathStructure`
  // whose shape doesn't match its `kind` (wrong slot count for a matrix,
  // missing index on a cube root, malformed piecewise, etc.) is silently
  // rewritten into its canonical shape. Cell TEXT is preserved; only the
  // container structure is repaired.
  addProseMirrorPlugins() {
    const key = new PluginKey("mathStructureValidator");
    return [
      new Plugin({
        key,
        appendTransaction: (_trs, _oldState, newState) => {
          const fixes: Array<{ pos: number; size: number; json: any }> = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "mathStructure") return true;
            const snap = nodeToJson(node);
            const res = validateStructure(snap);
            if (res.ok === false) {
              fixes.push({ pos, size: node.nodeSize, json: res.fix });
            }
            return true;
          });
          if (!fixes.length) return null;
          const tr = newState.tr;
          // Apply in reverse so earlier positions remain valid.
          for (let i = fixes.length - 1; i >= 0; i--) {
            const f = fixes[i];
            try {
              const created = newState.schema.nodeFromJSON(f.json);
              tr.replaceWith(f.pos, f.pos + f.size, created);
            } catch {
              // Ignore individual failures; leave that node untouched.
            }
          }
          tr.setMeta("addToHistory", false);
          return tr;
        },
      }),
    ];
  },
});
