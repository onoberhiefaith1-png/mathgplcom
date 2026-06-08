// Inline math node for TipTap. Stores LaTeX-lite in `value` and renders
// through `renderMathInline` so the on-screen math matches the smartboard
// + floating-number pipeline.
//
// Edit affordance: double-click (or Enter while selected) opens a small
// chip-based editor. The teacher NEVER sees raw LaTeX or "computer code"
// — only the live rendered equation, a backspace control, and quick
// symbol chips. A hidden input keeps Enter/Esc keyboard semantics.

import { Node, mergeAttributes, InputRule } from "@tiptap/core";
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

function MathInlineView({ node, updateAttributes, selected, editor }: NodeViewProps) {
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
      <NodeViewWrapper as="span" className="inline-block align-baseline relative" contentEditable={false}>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white border border-foreground/20 shadow-sm align-baseline text-black">
          <span className="inline-block min-w-[2ch] text-[16px] text-black">
            {previewLatex ? renderMathInline(previewLatex) : <span className="opacity-50 text-xs">tap a symbol to start</span>}
          </span>
          {/* Hidden but focusable input — keeps Enter/Esc + IME working without ever showing raw LaTeX. */}
          <input
            ref={hiddenInputRef}
            autoFocus
            value=""
            onChange={() => { /* no direct typing — chips only */ }}
            onBlur={cancel}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              else if (e.key === "Escape") { e.preventDefault(); cancel(); }
              else if (e.key === "Backspace") { e.preventDefault(); backspace(); }
            }}
            aria-label="Math editor"
            className="sr-only"
          />
        </span>
        <span className="absolute left-0 top-full mt-1 z-30 flex flex-wrap items-center gap-1 p-1.5 rounded-md bg-white border border-foreground/20 shadow-md text-[12px] text-black max-w-[320px]">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); appendChip(s.insert); hiddenInputRef.current?.focus(); }}
              className="px-1.5 py-0.5 rounded text-black hover:bg-muted min-w-[24px]"
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
          <span className="ml-1 text-[10px] text-black/60 hidden sm:inline">Enter saves · Esc cancels</span>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); commit(); }}
            className="ml-auto px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium"
          >
            Done
          </button>
        </span>
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
      as="span"
      className={`inline-flex items-baseline align-baseline px-0.5 rounded ${selected ? "bg-primary/15" : "hover:bg-foreground/5"}`}
      onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); open(); }}
      onTouchEnd={handleTap}
      title="Double-click to edit"
    >
      <span>
        {value ? renderMathInline(value) : <span className="opacity-40 text-xs px-1">[math]</span>}
      </span>
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
      new InputRule({
        find: /([A-Za-z0-9\)\]])\s*\^\s*\{([^{}]*)\}$/,
        handler: ({ state, range, match }) => {
          const value = `${match[1]}^{${match[2]}}`;
          state.tr.replaceWith(range.from, range.to, state.schema.nodes.mathInline.create({ value }));
        },
      }),
      new InputRule({
        find: /([A-Za-z0-9\)\]])\s*_\s*\{([^{}]*)\}$/,
        handler: ({ state, range, match }) => {
          const value = `${match[1]}_{${match[2]}}`;
          state.tr.replaceWith(range.from, range.to, state.schema.nodes.mathInline.create({ value }));
        },
      }),
    ];
  },
});
