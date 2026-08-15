// Block-level math node for TipTap.
//
// Editing model (Word-like): a single click puts a text caret straight inside
// the line. The line becomes a plain single-line editable field holding the
// friendly math source, so the teacher can type, backspace, delete, retype and
// select normally. There is no symbol palette, no "Done" button and no
// line-breaking mini editor — leaving the line commits it.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { latexToFriendly, friendlyToLatex } from "@/lib/notebook/mathFriendly";
import { isSafeLatex } from "@/lib/notebook/mathSafety";

function MathBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const value = (node.attrs.value as string) ?? "";
  const [editing, setEditing] = useState(false);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const initialDraftRef = useRef("");
  const pendingCaretRef = useRef<{ x: number; y: number } | null>(null);

  const open = (at?: { x: number; y: number }) => {
    initialDraftRef.current = latexToFriendly(value);
    pendingCaretRef.current = at ?? null;
    setEditing(true);
  };

  /** Commit whatever is in the field. Never destructive: unsafe input is kept
   *  as-is in friendly form so the teacher's keystrokes are not thrown away. */
  const commit = () => {
    const text = (fieldRef.current?.innerText ?? "").replace(/\n/g, " ").trim();
    setEditing(false);
    if (text === initialDraftRef.current.trim()) return;
    if (!text) {
      // Emptied line: remove the node so the document closes up like a doc.
      try {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos != null && editor) {
          editor.chain().focus()
            .deleteRange({ from: pos, to: pos + node.nodeSize })
            .run();
          return;
        }
      } catch { /* fall through */ }
    }
    const next = friendlyToLatex(text);
    updateAttributes({ value: isSafeLatex(next) ? next : text });
  };

  /** Place the caret where the teacher actually clicked. */
  useLayoutEffect(() => {
    if (!editing) return;
    const el = fieldRef.current;
    if (!el) return;
    el.innerText = initialDraftRef.current;
    el.focus();
    const at = pendingCaretRef.current;
    pendingCaretRef.current = null;
    const sel = window.getSelection();
    if (!sel) return;
    let range: Range | null = null;
    if (at) {
      const d = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      const r = d.caretRangeFromPoint?.(at.x, at.y) ?? null;
      if (r && el.contains(r.startContainer)) range = r;
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editing]);

  // Enter on a selected (non-editing) line also opens it for typing.
  useEffect(() => {
    if (!selected || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editing, value]);

  if (editing) {
    return (
      <NodeViewWrapper className="my-0.5" contentEditable={false}>
        <div
          ref={fieldRef}
          role="textbox"
          aria-label="Edit this line"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              commit();
            }
          }}
          className="px-1 py-0.5 rounded outline-hidden bg-primary/5 ring-1 ring-primary/30 font-mono text-[15px] leading-[1.5] whitespace-pre-wrap"
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
      {value
        ? <span className="inline-block align-baseline">{renderMathInline(value)}</span>
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
