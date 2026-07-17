// Inline math node for TipTap. Stores LaTeX-lite in `value` and renders
// through `renderMathInline`.
//
// Editing model: every superscript (`^{…}`) and subscript (`_{…}`) is a
// full-fledged, nestable mathematical WORKSPACE. Once the chip editor is
// open, keyboard input is processed by the chip itself (not the outer
// TipTap document), so `#` and `##` navigate the mathematical tree without
// ever falling back to Unicode glyph substitution:
//
//   #    — attach a superscript workspace to the object immediately to the
//          left of the cursor. Appends `^{`. Depth++.
//   ##   — attach a subscript workspace instead. If typed immediately after
//          a `#` (draft ends with `^{`), that trailing `^{` is downgraded to
//          `_{` in place. Otherwise appends `_{` to the current parent.
//   Space — climb one level: close the innermost open brace and step back
//          into the parent workspace. If no open braces remain, commit the
//          chip and return the cursor to the surrounding prose. (Prose then
//          treats the *next* Space as a real space.)
//
// Activation rules (per user spec):
//   * `#` or `##` at the start of an empty draft is inserted as a literal
//     `#` character — a superscript/subscript cannot exist without a parent.
//   * `#` immediately after `{` (empty workspace, no parent yet) is ignored.
//
// The chip also accepts symbol tiles for quick insertion. The rendered
// preview always auto-closes any open braces so the teacher sees live math
// while typing.

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

/** Count unmatched `{` in `s`. Ignores braces that are already closed. */
function openBraceDepth(s: string): number {
  let d = 0;
  for (const ch of s) {
    if (ch === "{") d++;
    else if (ch === "}" && d > 0) d--;
  }
  return d;
}

/** Append `n` closing braces so the string is renderable mid-edit. */
function autoCloseBraces(s: string): string {
  const d = openBraceDepth(s);
  return d > 0 ? s + "}".repeat(d) : s;
}

/** True when the last non-brace char of `draft` is a legal parent object for
 *  a superscript or subscript. */
function hasValidParent(draft: string): boolean {
  // Look at the last char. If it's `{`, we are inside an empty workspace —
  // no parent yet. If the last char is a mathematical object character
  // (letter, digit, closing bracket) or `}` (a completed workspace), a new
  // sup/sub can attach to it.
  const last = draft[draft.length - 1];
  if (!last) return false;
  if (last === "{") return false;
  return /[A-Za-z0-9)\]}]/.test(last);
}

function MathInlineView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const value = (node.attrs.value as string) ?? "";
  const autoEdit = Boolean(node.attrs.autoEdit);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const lastTapRef = useRef(0);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const initialDraftRef = useRef("");

  const open = (initialDraft?: string) => {
    const start = initialDraft ?? latexToFriendly(value);
    initialDraftRef.current = start;
    setDraft(start);
    setEditing(true);
    try { editor?.commands.blur(); } catch { /* noop */ }
  };

  // Auto-open when the node was inserted with `autoEdit: true` (e.g. by the
  // prose-level `#` handler). The draft starts from the raw LaTeX value so
  // the trailing `^{` (or `_{`) is preserved.
  useEffect(() => {
    if (autoEdit && !editing) {
      open(value);
      updateAttributes({ autoEdit: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  const cancel = () => setEditing(false);

  const commit = (draftOverride?: string) => {
    const finalDraft = autoCloseBraces(draftOverride ?? draft);
    if (finalDraft.trim() === initialDraftRef.current.trim()) {
      setEditing(false);
      return;
    }
    const next = friendlyToLatex(finalDraft);
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
  const backspace = () => setDraft((d) => {
    // Delete `^{` or `_{` as a pair so the teacher can un-do a `#` press in
    // one keystroke.
    if (d.endsWith("^{") || d.endsWith("_{")) return d.slice(0, -2);
    return d.slice(0, -1);
  });
  const clearAll = () => setDraft("");

  /** Central keyboard handler for the chip. Governs the `#` / `##` / Space
   *  tree navigation model. */
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); return; }
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
    if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === " ") {
      e.preventDefault();
      setDraft((d) => {
        const depth = openBraceDepth(d);
        if (depth > 0) {
          // Close the innermost workspace: `x^{2^{5` → `x^{2^{5}`.
          return d + "}";
        }
        // Fully out of every workspace: commit and return to prose. The
        // outer editor will treat the NEXT space as a real space.
        commit(d);
        return d;
      });
      return;
    }

    if (e.key === "#") {
      e.preventDefault();
      setDraft((d) => {
        if (d.endsWith("^{") || d.endsWith("_{")) {
          // Second `#` right after the first: downgrade to a subscript.
          return d.slice(0, -2) + "_{";
        }
        // Rule: a superscript/subscript must always have a parent object.
        // Empty draft or last char `{` means no parent → ignore the press.
        if (!hasValidParent(d)) return d;
        return d + "^{";
      });
      return;
    }

    // Any other single printable character: append.
    if (e.key.length === 1) {
      e.preventDefault();
      const k = e.key;
      setDraft((d) => d + k);
    }
  };

  if (editing) {
    const previewLatex = friendlyToLatex(autoCloseBraces(draft));
    return (
      <NodeViewWrapper as="span" className="inline-block align-baseline relative" contentEditable={false}>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white border border-foreground/20 shadow-sm align-baseline text-black">
          <span className="inline-block min-w-[2ch] text-[16px] text-black">
            {previewLatex
              ? renderMathInline(previewLatex)
              : <span className="opacity-50 text-xs">type — press # for superscript, ## for subscript</span>}
          </span>
          {/* Focusable, but visually collapsed. All typing is routed through
              handleKey — the input's own value stays empty. */}
          <input
            ref={hiddenInputRef}
            autoFocus
            value=""
            onChange={() => { /* typing is captured by handleKey */ }}
            onBlur={() => commit()}
            onKeyDown={handleKey}
            aria-label="Math editor"
            className="sr-only"
          />
        </span>
        <span className="absolute left-0 top-full mt-1 z-30 flex flex-wrap items-center gap-1 p-1.5 rounded-md bg-white border border-foreground/20 shadow-md text-[12px] text-black max-w-[360px]">
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
          <span className="ml-1 text-[10px] text-black/60 hidden sm:inline">
            # sup · ## sub · Space exits one level · Enter saves · Esc cancels
          </span>
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
      // Transient flag: when true, the node view auto-opens its editor on
      // mount, then clears the flag. Used by the prose `#` handler so the
      // teacher continues typing seamlessly into the new workspace.
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
