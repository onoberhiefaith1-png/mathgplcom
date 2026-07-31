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

/** True when the tree parser cannot faithfully represent `value`. Such a node
 *  must NOT be painted from the tree — it would leak backslash text. It is
 *  displayed through the classroom renderer instead (the same pipeline the AI
 *  Edit preview uses) until the teacher clicks in to edit. */
function isLossy(value: string): boolean {
  const src = latexToFriendlyForTree(value);
  if (!src.trim()) return false;
  try {
    const norm = (s: string) => s.replace(/\s+/g, "");
    return norm(treeToLatex(latexToTree(src))) !== norm(src);
  } catch {
    return true;
  }
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

function MathInlineView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const [root, setRoot] = useState<Row>(() => parseTree(node.attrs as Record<string, unknown>));
  const [focused, setFocused] = useState<boolean>(Boolean(node.attrs.autoEdit));

  useEffect(() => {
    if (node.attrs.autoEdit) {
      updateAttributes({ autoEdit: false });
      try { editor?.commands.blur(); } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: Row) => {
    setRoot(next);
    const value = treeToLatex(next);
    updateAttributes({ value, tree: JSON.stringify(next) });
  };

  const handleBlur = () => {
    setFocused(false);
    // Return caret to prose immediately after the math node.
    try {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos != null && editor) {
        editor.chain().focus().setTextSelection(pos + node.nodeSize).run();
      }
    } catch { /* noop */ }
  };

  const empty = useMemo(() => root.length === 0, [root]);
  const value = String(node.attrs.value ?? "");
  const lossy = useMemo(() => !node.attrs.tree && isLossy(value), [node.attrs.tree, value]);

  // Display gate: an expression the tree cannot represent is shown with the
  // classroom renderer (identical to the AI Edit preview) rather than as raw
  // markup. Clicking it still opens the editable canvas.
  if (lossy && !focused) {
    return (
      <NodeViewWrapper as="span" className="inline-block align-baseline" contentEditable={false}>
        <span
          role="button"
          tabIndex={0}
          className="cursor-text"
          onClick={() => setFocused(true)}
          onFocus={() => setFocused(true)}
        >
          {renderMathInline(latexToFriendlyForTree(value), "mi")}
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline" contentEditable={false}>
      <MathInlineCanvas
        root={root}
        onChange={commit}
        onBlur={handleBlur}
        focused={focused}
        onFocus={() => setFocused(true)}
      />
      {empty && !focused && (
        <span className="opacity-40 text-xs px-1">[math]</span>
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
