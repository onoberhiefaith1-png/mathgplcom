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
import { composeNotation, normaliseFns } from "@/lib/lessonnotes/matrixFunctions";

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

// ── Stretchy matrix fence ───────────────────────────────────────────────
// Brackets are NEVER fixed-size glyphs. Each fence is an inline SVG that
// stretches to the measured height of the cell block (it is a grid item
// spanning every matrix row with `align-self: stretch`), so a 2x2 gets a
// short fence, a 4x3 a tall one, and a 3x4 grows horizontally with the
// columns. `preserveAspectRatio="none"` + `vector-effect` keeps the stroke
// weight constant while the shape scales.
function MatrixFence({
  bracket, side, style,
}: { bracket: string; side: "L" | "R"; style: React.CSSProperties }) {
  const w = bracket === "{" ? 9 : bracket === "|" ? 3 : bracket === "‖" ? 6 : 7;
  const flip = side === "R";
  let body: React.ReactNode = null;
  if (bracket === "(") {
    body = <path d="M6 2 C2 25, 2 75, 6 98" />;
  } else if (bracket === "[") {
    body = <path d="M6 2 H2 V98 H6" />;
  } else if (bracket === "{") {
    body = <path d="M8 2 C5 2, 5 30, 4.4 47 C4.2 49, 3 50, 1.6 50 C3 50, 4.2 51, 4.4 53 C5 70, 5 98, 8 98" />;
  } else if (bracket === "‖") {
    body = <><path d="M2 1 V99" /><path d="M5.5 1 V99" /></>;
  } else {
    body = <path d="M2 1 V99" />;
  }

  return (
    <span
      className="math-struct__fence-svg"
      contentEditable={false}
      aria-hidden
      style={{ ...style, width: `${w * 0.075}em` }}
    >
      <svg viewBox={`0 0 ${w + 2} 100`} preserveAspectRatio="none" width="100%" height="100%"
        style={flip ? { transform: "scaleX(-1)" } : undefined}>
        <g fill="none" stroke="currentColor" strokeWidth={bracket === "|" ? 1.6 : 1.5}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          {body}
        </g>
      </svg>
    </span>
  );
}

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

  // Matrix notation (transpose / inverse / det / norm …). Pure notation —
  // nothing is ever calculated. Each selected function becomes a layer of
  // ONE merged expression around the same matrix.
  const notation = isMatrix ? composeNotation(normaliseFns(extraAttrs.fns)) : null;
  const supText = notation?.sup ?? "";
  const hasPower = !!notation?.power;

  const style: React.CSSProperties = {};
  const cssVars = style as Record<string, string>;
  // Column layout for a matrix expression:
  //   [‖] [det] ( cells ) [sup] [power] [‖]
  // Every decoration spans all rows and is explicitly placed, so the cell
  // slots auto-flow into exactly the cell columns.
  let colNormL = 0, colPrefix = 0, colLB = 1, colRB = 2, colSup = 0, colPower = 0, colNormR = 0;
  if (isMatrix && rows && cols) {
    const parts: string[] = [];
    let n = 0;
    const take = () => { parts.push("max-content"); return ++n; };
    if (notation?.norm) colNormL = take();
    if (notation?.prefix) colPrefix = take();
    colLB = take();
    parts.push(`repeat(${cols}, minmax(1.2em, max-content))`);
    n += cols;
    colRB = take();
    if (supText) colSup = take();
    if (hasPower) colPower = take();
    if (notation?.norm) colNormR = take();

    style.gridTemplateColumns = parts.join(" ");
    style.gridTemplateRows = `repeat(${rows}, auto)`;
    // Brackets are pseudo-elements; they read their columns from these vars
    // so they always hug the cell block and grow with the row count.
    cssVars["--matrix-rows"] = String(rows);
    cssVars["--matrix-cols"] = String(cols);
    cssVars["--mx-lb"] = String(colLB);
    cssVars["--mx-rb"] = String(colRB);
    if (colPower) cssVars["--mx-pw"] = String(colPower);
  } else if (rows && cols) {
    const cells = `repeat(${cols}, minmax(1.2em, max-content))`;
    style.gridTemplateColumns = cells;
    style.gridTemplateRows = `repeat(${rows}, auto)`;
  }

  const spanAllRows = rows ? `1 / ${rows + 1}` : undefined;

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
      data-overline={notation?.overline ? "true" : undefined}
      data-power={hasPower ? "true" : undefined}
      style={style}
    >
      {op && <span className="math-struct__op ms-op" contentEditable={false} aria-hidden>{op}</span>}
      {mark && <span className="math-struct__mark ms-mark" contentEditable={false} aria-hidden>{mark}</span>}
      {idx && <span className="math-struct__index ms-index" contentEditable={false} aria-hidden>{idx}</span>}
      {isMatrix && rows && cols && (
        <>
          <MatrixFence bracket={br || "("} side="L"
            style={{ gridColumn: colLB, gridRow: spanAllRows, alignSelf: "stretch" }} />
          <MatrixFence bracket={br || "("} side="R"
            style={{ gridColumn: colRB, gridRow: spanAllRows, alignSelf: "stretch" }} />
        </>
      )}
      {isMatrix && notation?.norm && rows && (
        <>
          <MatrixFence bracket="‖" side="L"
            style={{ gridColumn: colNormL, gridRow: spanAllRows, alignSelf: "stretch" }} />
          <MatrixFence bracket="‖" side="R"
            style={{ gridColumn: colNormR, gridRow: spanAllRows, alignSelf: "stretch" }} />
        </>
      )}

      {isMatrix && notation?.prefix && rows && (
        <span className="math-struct__fn" contentEditable={false}
          style={{ gridColumn: colPrefix, gridRow: spanAllRows }}>{notation.prefix}</span>
      )}
      {isMatrix && supText && (
        <span className="math-struct__sup" contentEditable={false} aria-hidden
          style={{ gridColumn: colSup, gridRow: 1 }}>{supText}</span>
      )}
      {isMatrix && notation?.overline && rows && cols && (
        <span className="math-struct__overline" contentEditable={false} aria-hidden
          style={{ gridColumn: `${colLB} / span ${cols + 2}`, gridRow: 1 }} />
      )}
      {isMatrix && typeof divider === "number" && cols && rows && (
        <span
          className="math-struct__divider"
          contentEditable={false}
          aria-hidden
          style={{ gridColumn: colLB + divider + 1, gridRow: `1 / ${rows + 1}` }}
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
