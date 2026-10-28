// Block-level math node for TipTap.
//
// ONE ENGINE, TWO SURFACES — and neither of them is text:
//   display  → `renderMathInline` (the exact AI Edit preview renderer)
//   editing  → `MathInlineCanvas` (structural: subscripts, fractions and
//              radicals are real editable regions)
//
// There is deliberately NO source field here. A teacher must never see
// `log_2`, `\frac{}{}`, `^{}` or any other raw mathematical syntax inside a
// lesson note.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { latexToTree, treeToLatex } from "@/lib/smartboard/mathTreeLatex";
import type { Row } from "@/lib/smartboard/mathTree";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { MathInlineCanvas } from "./MathInlineCanvas";

function MathBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const value = (node.attrs.value as string) ?? "";
  const display = useMemo(() => normalizeMathSource(value), [value]);
  const [editing, setEditing] = useState(false);
  const [root, setRoot] = useState<Row>(() => {
    try { return latexToTree(normalizeMathSource(value)); } catch { return [] as unknown as Row; }
  });
  const [entryPoint, setEntryPoint] = useState<{ x: number; y: number } | null>(null);

  const open = (at?: { x: number; y: number }) => {
    try { setRoot(latexToTree(display)); } catch { /* keep current tree */ }
    setEntryPoint(at ?? null);
    setEditing(true);
  };

  const commit = (next: Row) => {
    setRoot(next);
    updateAttributes({ value: normalizeMathSource(treeToLatex(next)) });
  };

  const close = () => {
    setEditing(false);
    setEntryPoint(null);
    // Emptied line: remove the node so the document closes up like a doc.
    const emptied = (() => {
      try { return !normalizeMathSource(treeToLatex(root)).trim(); } catch { return false; }
    })();
    try {
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos == null || !editor) return;
      if (emptied) {
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      } else {
        editor.chain().focus().setTextSelection(pos + node.nodeSize).run();
      }
    } catch { /* noop */ }
  };

  // Enter on a selected (non-editing) line also opens it for typing.
  useEffect(() => {
    if (!selected || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editing, display]);

  if (editing) {
    return (
      <NodeViewWrapper className="my-0.5 px-1" contentEditable={false}>
        <MathInlineCanvas
          root={root}
          onChange={commit}
          onBlur={close}
          focused
          onFocus={() => setEditing(true)}
          entryPoint={entryPoint}
          onExitLeft={close}
          onExitRight={close}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={`my-0.5 px-1 py-0 rounded leading-[1.15] cursor-text ${selected ? "bg-primary/10" : "hover:bg-foreground/5"}`}
      onMouseDown={(e: React.MouseEvent) => {
        // Left click only, and never while the teacher is dragging a selection.
        if (e.button !== 0 || e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        open({ x: e.clientX, y: e.clientY });
      }}
    >
      {display
        ? <span className="inline-block align-baseline math-inline-display">{renderMathInline(display, "mb")}</span>
        : <span className="opacity-40 text-xs">[empty line — click to type]</span>}
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
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
      subsectionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-subsection-id") || null,
        renderHTML: (attrs) =>
          attrs.subsectionId ? { "data-subsection-id": attrs.subsectionId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});
