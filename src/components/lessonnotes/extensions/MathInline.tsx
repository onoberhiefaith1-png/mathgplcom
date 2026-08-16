// Inline math node for TipTap. Rendered as an interactive tree-based
// canvas so every superscript, subscript, numerator, denominator and
// radical is a freely-editable region — the caret can enter/leave any
// of them at any time.
//
// Attributes:
//   value  — canonical LaTeX-lite. Used by read-only renderers
//            (docx export, previews) and as the source of truth on load.
//   tree   — JSON of the mathTree `Row`. Written on every edit; the node
//            view lazily parses `value` into a tree on first mount.

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import type { Row } from "@/lib/smartboard/mathTree";
import { MathInlineCanvas } from "./MathInlineCanvas";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { latexToFriendly } from "@/lib/notebook/mathFriendly";

/** Mathematical words that do not make a value "a sentence". */
const MATH_WORDS = new Set([
  "log", "ln", "exp", "sin", "cos", "tan", "cot", "sec", "csc", "sinh",
  "cosh", "tanh", "arcsin", "arccos", "arctan", "lim", "max", "min", "det",
  "gcd", "lcm", "mod", "deg", "arg", "sqrt", "frac", "text",
]);

/** True when the value carries real sentence prose (a 4+ letter word that is
 *  not a function name), i.e. it is a full-line object rather than a bare
 *  calculation. */
export function hasProseWords(value: string): boolean {
  const bare = value.replace(/\\[A-Za-z]+/g, " ");
  const words = bare.match(/[A-Za-z]{4,}/g) ?? [];
  return words.some((w) => !MATH_WORDS.has(w.toLowerCase()));
}


function parseTree(attrs: Record<string, unknown>): Row {
  const t = attrs.tree;
  if (typeof t === "string" && t.length > 0) {
    try { return JSON.parse(t) as Row; } catch { /* fall through */ }
  }
  const value = String(attrs.value ?? "");
  const tree = latexToTree(latexToFriendlyForTree(value));
  assertParseRoundTrip(value, tree);
  return tree;
}




/** Structure check: the parser must be lossless. If re-serialising the tree
 *  does not reproduce the stored value, the parse dropped or mangled math
 *  (this is how raw `\frac{...}` once leaked into lesson notes). Surface it
 *  loudly in dev instead of silently rendering broken math. */
function assertParseRoundTrip(value: string, tree: Row): void {
  if (!value.trim()) return;
  try {
    const back = treeToLatex(tree);
    const norm = (s: string) => s.replace(/\s+/g, "");
    if (norm(back) !== norm(latexToFriendlyForTree(value))) {
      // eslint-disable-next-line no-console
      console.warn("[mathInline] lossy LaTeX parse", { value, reparsed: back });
    }
  } catch {
    /* never break rendering over a diagnostic */
  }
}

/** Strip trailing open braces before parsing (legacy autoEdit drafts stored
 *  half-open `x^{` values). The canvas doesn't need the open brace — the
 *  cursor position expresses it. */
function latexToFriendlyForTree(v: string): string {
  // One shared normalization + brace balancing, identical to the AI Edit
  // preview, so both surfaces see the same source string.
  return normalizeMathSource(v);
}

function MathInlineView({ node, updateAttributes, editor, getPos, selected }: NodeViewProps) {
  const [root, setRoot] = useState<Row>(() => parseTree(node.attrs as Record<string, unknown>));
  const [focused, setFocused] = useState<boolean>(Boolean(node.attrs.autoEdit));
  // Point of the click that opened the editor, replayed so the caret lands
  // exactly where the teacher clicked on the rendered expression.
  const [entryPoint, setEntryPoint] = useState<{ x: number; y: number } | null>(null);
  // Caret position requested by whoever created the node (the `#` shortcut
  // asks for the empty power slot).
  const entryCursor = useMemo(() => {
    const raw = node.attrs.entry;
    if (typeof raw !== "string" || !raw) return null;
    try { return JSON.parse(raw) as { path: number[]; index: number }; } catch { return null; }
  }, [node.attrs.entry]);

  useEffect(() => {
    if (node.attrs.autoEdit) {
      updateAttributes({ autoEdit: false, entry: "" });
      try { editor?.commands.blur(); } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: Row) => {
    setRoot(next);
    // Layout Normalizer runs on every commit, so the stored value is already
    // tight — the display renderer never has to undo editing spacing.
    const value = normalizeMathSource(treeToLatex(next));
    updateAttributes({ value, tree: JSON.stringify(next) });
  };

  /** Hand the caret back to the prose on either side of this object. */
  const exitTo = (side: "left" | "right") => {
    setFocused(false);
    setEntryPoint(null);
    try {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null || !editor) return;
      const at = side === "left" ? pos : pos + node.nodeSize;
      editor.chain().focus().setTextSelection(at).run();
    } catch { /* noop */ }
  };

  const handleBlur = () => {
    setFocused(false);
    setEntryPoint(null);
    // Return caret to prose immediately after the math node.
    try {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos != null && editor) {
        editor.chain().focus().setTextSelection(pos + node.nodeSize).run();
      }
    } catch { /* noop */ }
  };

  const empty = useMemo(() => root.length === 0, [root]);
  // ONE ENGINE FOR DISPLAY: whenever the teacher is not inside the object it
  // is painted by `renderMathInline` — the exact renderer the AI Edit preview
  // uses — so an expression looks identical in AI Edit, the note, Present
  // mode and export. The tree canvas is an editing surface only.
  const display = useMemo(
    () => normalizeMathSource(String(node.attrs.value ?? "") || treeToLatex(root)),
    [node.attrs.value, root],
  );

  return (
    <NodeViewWrapper
      as="span"
      className={`inline align-baseline math-inline-node${selected ? " math-inline-node--selected" : ""}`}
      contentEditable={false}
    >
      {focused ? (
        <MathInlineCanvas
          entryPoint={entryPoint}
          entryCursor={entryCursor}
          root={root}
          onChange={commit}
          onBlur={handleBlur}
          focused
          onFocus={() => setFocused(true)}
          onExitLeft={() => exitTo("left")}
          onExitRight={() => exitTo("right")}
        />
      ) : empty ? (
        <span
          className="cursor-text opacity-40 text-xs px-1"
          onMouseDown={(e) => { setEntryPoint({ x: e.clientX, y: e.clientY }); setFocused(true); }}
        >
          [math]
        </span>
      ) : (
        <span
          className="math-inline-display math-inline-selectable cursor-text"
          onMouseDown={(e) => {
            // Enter editing from the *normalized* source so the caret works on
            // exactly what was on screen (no stale editing spacing).
            try { setRoot(latexToTree(display)); } catch { /* keep current tree */ }
            setEntryPoint({ x: e.clientX, y: e.clientY });
            setFocused(true);
          }}
        >
          {renderMathInline(display, "mi")}
        </span>
      )}
    </NodeViewWrapper>
  );


}



export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      value: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-value") ?? "",
        renderHTML: (attrs) => ({ "data-value": attrs.value ?? "" }),
      },
      tree: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-tree") ?? "",
        renderHTML: (attrs) => (attrs.tree ? { "data-tree": attrs.tree } : {}),
      },
      entry: {
        default: "",
        parseHTML: () => "",
        renderHTML: () => ({}),
        keepOnSplit: false,
      },
      autoEdit: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
        keepOnSplit: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-inline": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}$/,
        handler: ({ state, range, match }) => {
          const value = `\\frac{${match[1]}}{${match[2]}}`;
          state.tr.replaceWith(range.from, range.to, state.schema.nodes.mathInline.create({ value }));
        },
      }),
      new InputRule({
        find: /\\sqrt(?:\[[^\]]*\])?\s*\{([^{}]*)\}$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, state.schema.nodes.mathInline.create({ value: match[0] }));
        },
      }),
    ];
  },
});
