// Keyboard productivity for math typing.
//
//   `#`  in prose, after a valid parent object (letter/digit/`)`/`]`), converts
//        the last mathematical term to the left into a `mathInline` node whose
//        value is `<term>^{`. The node auto-opens its editor. All further
//        `#` / `##` / Space handling happens inside the math node view, where
//        every superscript and subscript is itself a full recursive math
//        workspace (see MathInline.tsx).
//
//   `#`  in prose with no valid parent (start of line, after a space, after an
//        operator) is inserted as a literal `#` character. This preserves the
//        ability to type the `#` glyph as normal text.
//
//   `(`, `[`, `{`, `|`  auto-pair a closing bracket and drop the caret between
//        them; typing the matching closer just before it skips over. Backspace
//        immediately after an autopair deletes both.
//
//   `/`  converts the last mathematical term into the numerator of a fraction
//        (`\frac{term}{}`).
//
// We do NOT intercept Shift/Ctrl. Those keys have too many OS, browser, and
// editor bindings. `#` is the trigger, but only when there is something to
// attach the new mathematical workspace to.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { friendlyToLatex } from "@/lib/notebook/mathFriendly";
import { isSafeLatex } from "@/lib/notebook/mathSafety";
import { latexToTree } from "@/lib/smartboard/mathTreeLatex";

const OPEN_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "|": "|",
};

const key = new PluginKey("mathKeyShortcuts");

interface PluginState {
  lastPair: { closerPos: number; closer: string } | null;
}

/** Walk backwards to find the last "mathematical term" ending at `pos`. */
function findLastTermStart(text: string, endInText: number): number {
  let i = endInText;
  let parenDepth = 0;
  while (i > 0) {
    const ch = text[i - 1];
    if (ch === ")" || ch === "]") { parenDepth++; i--; continue; }
    if (ch === "(" || ch === "[") {
      if (parenDepth === 0) break;
      parenDepth--; i--; continue;
    }
    if (parenDepth > 0) { i--; continue; }
    if (/[A-Za-z0-9._]/.test(ch)) { i--; continue; }
    break;
  }
  return i;
}

/** True when `ch` is a mathematical object that a superscript/subscript can
 *  legally attach to. */
function isValidParentChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9)\]}]/.test(ch);
}

export const MathKeyShortcuts = Extension.create({
  name: "mathKeyShortcuts",

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key,
        state: {
          init: (): PluginState => ({ lastPair: null }),
          apply: (tr, prev): PluginState => {
            const meta = tr.getMeta(key);
            let next = prev;
            if (meta) next = { ...next, ...meta };
            if (tr.docChanged && !meta && next.lastPair) {
              next = { ...next, lastPair: null };
            }
            return next;
          },
        },
        props: {
          handleTextInput(view, from, to, text) {
            if (text.length !== 1) return false;
            const ch = text;
            if (ch !== "#") return false;

            // `#` in prose: promote the last mathematical term into a new
            // `mathInline` whose tree already contains a subsup with the
            // term as base and an empty (open) sup slot. The canvas mounts
            // focused with the cursor inside that sup slot.
            const schema = view.state.schema;
            const mathInline = schema.nodes.mathInline;
            if (!mathInline) return false;

            const $from = view.state.doc.resolve(from);
            const parent = $from.parent;
            const parentOffset = $from.parentOffset;
            if (parentOffset === 0) return false;
            const beforeText = parent.textBetween(0, parentOffset, undefined, "\ufffc");
            const prevChar = beforeText[beforeText.length - 1];
            if (!isValidParentChar(prevChar)) return false;

            const startInText = findLastTermStart(beforeText, beforeText.length);
            const term = beforeText.slice(startInText);
            if (!term) return false;

            const termStart = from - (beforeText.length - startInText);
            const termEnd = from;
            const latexTerm = friendlyToLatex(term);
            const value = `${latexTerm}^{}`;
            // Build the tree now so the canvas can mount already focused
            // with the caret inside the empty sup slot.
            // Deferred import to avoid pulling the tree code into the
            // extension's cold path when the shortcut is not used.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { latexToTree } = require("@/lib/smartboard/mathTreeLatex");
            const tree = JSON.stringify(latexToTree(value));
            const node = mathInline.create({ value, tree, autoEdit: true });
            const tr = view.state.tr.replaceWith(termStart, termEnd, node);
            const after = termStart + node.nodeSize;
            tr.setSelection(TextSelection.create(tr.doc, after));
            view.dispatch(tr);
            return true;
          },

          handleKeyDown(view, event) {
            const s = key.getState(view.state) as PluginState;

            const ch = event.key;

            // Bracket pairing.
            if (OPEN_CLOSE[ch] && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { from, to, empty } = view.state.selection;
              const opener = ch;
              const closer = OPEN_CLOSE[ch];
              const tr = view.state.tr;
              if (empty) {
                tr.insertText(opener + closer, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
                tr.setMeta(key, { lastPair: { closerPos: from + 1, closer } });
              } else {
                const before = view.state.doc.textBetween(from, to, "\ufffc");
                tr.insertText(opener + before + closer, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1, from + 1 + before.length));
                tr.setMeta(key, { lastPair: null });
              }
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // Overtype matching closer.
            if ((ch === ")" || ch === "]" || ch === "}" || ch === "|") &&
                !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { from, empty } = view.state.selection;
              if (empty) {
                const next = view.state.doc.textBetween(
                  from,
                  Math.min(from + 1, view.state.doc.content.size),
                );
                if (next === ch) {
                  view.dispatch(view.state.tr.setSelection(
                    TextSelection.create(view.state.doc, from + 1),
                  ));
                  event.preventDefault();
                  return true;
                }
              }
            }

            // Backspace immediately after an autopair → delete both.
            if (event.key === "Backspace" && s.lastPair) {
              const { from, empty } = view.state.selection;
              if (empty && from === s.lastPair.closerPos) {
                const tr = view.state.tr.delete(from - 1, from + 1);
                tr.setMeta(key, { lastPair: null });
                view.dispatch(tr);
                event.preventDefault();
                return true;
              }
            }

            // `/` → smart fraction on the last term.
            if (ch === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
              const schema = view.state.schema;
              const mathInline = schema.nodes.mathInline;
              if (!mathInline) return false;
              const { $from, empty } = view.state.selection;
              if (!empty) return false;
              const parent = $from.parent;
              const parentOffset = $from.parentOffset;
              const beforeText = parent.textBetween(0, parentOffset, undefined, "\ufffc");
              const startInText = findLastTermStart(beforeText, beforeText.length);
              const term = beforeText.slice(startInText).trim();
              const termStart = $from.pos - (beforeText.length - startInText);
              const termEnd = $from.pos;
              let latex: string;
              if (term.length === 0) {
                latex = "\\frac{}{}";
              } else {
                const num = friendlyToLatex(term);
                latex = `\\frac{${num}}{}`;
              }
              if (!isSafeLatex(latex)) return false;
              const node = mathInline.create({ value: latex });
              const tr = view.state.tr.replaceWith(termStart, termEnd, node);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
