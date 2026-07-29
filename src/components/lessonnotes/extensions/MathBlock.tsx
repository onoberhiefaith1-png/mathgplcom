// Block-level math node for TipTap. See MathInline for the editing model —
// the block view shares the same chip-only editor (no raw LaTeX visible).

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { latexToFriendly, friendlyToLatex } from "@/lib/notebook/mathFriendly";
import { isSafeLatex } from "@/lib/notebook/mathSafety";

const QUICK_SYMBOLS: { label: string; insert: string }[] = [
  { label: "½", insert: "1/2" },
  { label: "x²", insert: "^2" },
  { label: "x³", insert: "^3" },
  { label: "√", insert: "sqrt(" },
  { label: ")", insert: ")" },
  { label: "+", insert: "+" },
  { label: "−", insert: "-" },
  { label: "×", insert: "*" },
  { label: "÷", insert: "/" },
  { label: "=", insert: "=" },
  { label: "π", insert: "pi" },
  { label: "θ", insert: "theta" },
  { label: "∑", insert: "sum" },
  { label: "∫", insert: "int" },
];

function MathBlockView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const value = (node.attrs.value as string) ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const lastTapRef = useRef(0);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const initialDraftRef = useRef("");

  const open = () => {
    const friendly = latexToFriendly(value);
    initialDraftRef.current = friendly;
    setDraft(friendly);
    setEditing(true);
    try { editor?.commands.blur(); } catch { /* noop */ }
  };

  const cancel = () => setEditing(false);

  const commit = () => {
    if (draft.trim() === initialDraftRef.current.trim()) {
      setEditing(false);
      return;
    }
    const next = friendlyToLatex(draft);
    if (!isSafeLatex(next)) {
      setEditing(false);
      return;
    }
    updateAttributes({ value: next });
    setEditing(false);
  };

  useEffect(() => {
    if (!selected || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editing, value]);

  const appendChip = (snippet: string) => setDraft((d) => d + snippet);
  const backspace = () => setDraft((d) => d.slice(0, -1));
  const clearAll = () => setDraft("");

  if (editing) {
    const previewLatex = friendlyToLatex(draft);
    return (
      <NodeViewWrapper className="my-1.5" contentEditable={false}>
        <div className="rounded-md border border-foreground/20 bg-white text-black p-2 shadow-xs">
          <div className="min-h-[1.6em] text-[16px] leading-[1.6] mb-1.5 text-black">
            {previewLatex
              ? <span className="inline-block align-baseline">{renderMathInline(previewLatex)}</span>
              : <span className="opacity-50 text-xs">tap a symbol to start</span>}
          </div>
          <input
            ref={hiddenInputRef}
            autoFocus
            value=""
            onChange={() => { /* chips only */ }}
            onBlur={cancel}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancel(); }
              else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
            }}
            aria-label="Math editor"
            className="sr-only"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-black">
            {QUICK_SYMBOLS.map((s) => (
              <button
                key={s.label}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); appendChip(s.insert); hiddenInputRef.current?.focus(); }}
                className="px-1.5 py-0.5 rounded text-black hover:bg-muted border border-transparent hover:border-border min-w-[24px]"
                title={`Insert ${s.label}`}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); backspace(); hiddenInputRef.current?.focus(); }}
              className="px-2 py-0.5 rounded text-black hover:bg-muted"
              title="Delete last"
            >⌫</button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); clearAll(); hiddenInputRef.current?.focus(); }}
              className="px-2 py-0.5 rounded text-black hover:bg-muted text-[11px]"
              title="Clear"
            >clear</button>
            <span className="ml-auto text-[10px] text-black/60">Enter saves · Esc cancels</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commit(); }}
              className="ml-1 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) open();
    lastTapRef.current = now;
  };

    return (
      <NodeViewWrapper
        className={`my-0.5 px-1 py-0 rounded leading-[1.15] ${selected ? "bg-primary/10" : "hover:bg-foreground/5"}`}
      onDoubleClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); open(); }}
      onTouchEnd={handleTap}
      title="Double-click to edit"
    >
      {value
        ? <span className="inline-block align-baseline">{renderMathInline(value)}</span>
        : <span className="opacity-40 text-xs">[math — double-click to edit]</span>}
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
