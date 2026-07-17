// Keyboard productivity for math typing:
//   - "#X"  → next character X becomes superscript (Unicode). The "#" trigger
//     is removed on successful conversion.
//   - "##X" → next character X becomes subscript. Both "##" triggers removed.
//   - Opening brackets auto-pair: ( [ { |  with caret between; wraps a selection.
//   - Typing the matching closer just before an auto-paired closer skips over it.
//   - Backspace immediately after an autopair removes both.
//   - "/" converts the last mathematical term into the numerator of a fraction.
//
// Design note: we do NOT intercept Shift/Ctrl. Those keys have too many OS,
// browser, and editor bindings. Using printable "#" as the trigger keeps the
// shortcut entirely inside the editor and avoids conflicts.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { friendlyToLatex } from "@/lib/notebook/mathFriendly";
import { isSafeLatex } from "@/lib/notebook/mathSafety";

const SUPER: Record<string, string> = {
  "0": "⁰","1": "¹","2": "²","3": "³","4": "⁴","5": "⁵","6": "⁶","7": "⁷","8": "⁸","9": "⁹",
  "+": "⁺","-": "⁻","=": "⁼","(": "⁽",")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ",
  i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ",
  r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};
const SUB: Record<string, string> = {
  "0": "₀","1": "₁","2": "₂","3": "₃","4": "₄","5": "₅","6": "₆","7": "₇","8": "₈","9": "₉",
  "+": "₊","-": "₋","=": "₌","(": "₍",")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ",
  n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const OPEN_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "|": "|",
};

const key = new PluginKey("mathKeyShortcuts");

interface PluginState {
  // Hash-trigger state. When the user types "#" we set pending="sup" and record
  // firstHashPos. A second "#" upgrades to pending="sub" and records secondHashPos.
  // The next printable character consumes the trigger.
  pending: null | "sup" | "sub";
  firstHashPos: number | null;
  secondHashPos: number | null;
  // Track most recent autopair for backspace-delete-pair behaviour.
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
    if (/[A-Za-z0-9._^]/.test(ch)) { i--; continue; }
    break;
  }
  return i;
}

export const MathKeyShortcuts = Extension.create({
  name: "mathKeyShortcuts",

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key,
        state: {
          init: (): PluginState => ({
            pending: null,
            firstHashPos: null,
            secondHashPos: null,
            lastPair: null,
          }),
          apply: (tr, prev): PluginState => {
            const meta = tr.getMeta(key);
            let next = prev;
            if (meta) next = { ...next, ...meta };
            // Any doc change (unless we set meta this same tr) invalidates
            // the autopair backspace tracker.
            if (tr.docChanged && !meta && next.lastPair) {
              next = { ...next, lastPair: null };
            }
            // If the selection moved away from the trigger area, clear pending.
            if (next.pending && tr.selectionSet && !meta) {
              const caret = tr.selection.from;
              const anchor = next.pending === "sup" ? next.firstHashPos : next.secondHashPos;
              // Caret must be immediately after the last trigger char.
              if (anchor === null || caret !== anchor + 1) {
                next = { ...next, pending: null, firstHashPos: null, secondHashPos: null };
              }
            }
            return next;
          },
        },
        props: {
          handleTextInput(view, from, to, text) {
            // Only single-character inputs are handled here. IMEs and paste
            // fall through to default behaviour.
            if (text.length !== 1) return false;
            const ch = text;
            const s = key.getState(view.state) as PluginState;

            // --- Hash trigger ---------------------------------------------
            if (s.pending === null && ch === "#") {
              // Insert the "#" and arm superscript mode at the caret that
              // follows it.
              const tr = view.state.tr.insertText("#", from, to);
              tr.setMeta(key, {
                pending: "sup",
                firstHashPos: from,
                secondHashPos: null,
              });
              view.dispatch(tr);
              return true;
            }

            if (s.pending === "sup") {
              if (ch === "#" && s.firstHashPos !== null && from === s.firstHashPos + 1) {
                // Upgrade to subscript mode.
                const tr = view.state.tr.insertText("#", from, to);
                tr.setMeta(key, {
                  pending: "sub",
                  firstHashPos: s.firstHashPos,
                  secondHashPos: from,
                });
                view.dispatch(tr);
                return true;
              }
              const mapped = SUPER[ch];
              if (mapped && s.firstHashPos !== null && from === s.firstHashPos + 1) {
                // Replace the "#" trigger with the mapped superscript glyph.
                const tr = view.state.tr.replaceWith(
                  s.firstHashPos,
                  from,
                  view.state.schema.text(mapped),
                );
                tr.setMeta(key, { pending: null, firstHashPos: null, secondHashPos: null });
                view.dispatch(tr);
                return true;
              }
              // No mapping / mismatch: clear pending, let default happen.
              view.dispatch(view.state.tr.setMeta(key, {
                pending: null, firstHashPos: null, secondHashPos: null,
              }));
              return false;
            }

            if (s.pending === "sub") {
              const mapped = SUB[ch];
              if (
                mapped &&
                s.firstHashPos !== null &&
                s.secondHashPos !== null &&
                from === s.secondHashPos + 1
              ) {
                // Replace "##" with the mapped subscript glyph.
                const tr = view.state.tr.replaceWith(
                  s.firstHashPos,
                  from,
                  view.state.schema.text(mapped),
                );
                tr.setMeta(key, { pending: null, firstHashPos: null, secondHashPos: null });
                view.dispatch(tr);
                return true;
              }
              view.dispatch(view.state.tr.setMeta(key, {
                pending: null, firstHashPos: null, secondHashPos: null,
              }));
              return false;
            }

            return false;
          },

          handleKeyDown(view, event) {
            const s = key.getState(view.state) as PluginState;

            // Bracket pairing on printable-char keydown.
            const ch = event.key;
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

            // Overtype closer when caret sits immediately before a matching one.
            if ((ch === ")" || ch === "]" || ch === "}" || ch === "|") &&
                !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { from, empty } = view.state.selection;
              if (empty) {
                const next = view.state.doc.textBetween(from, Math.min(from + 1, view.state.doc.content.size));
                if (next === ch) {
                  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1)));
                  event.preventDefault();
                  return true;
                }
              }
            }

            // Backspace immediately after autopair → delete both.
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

            // "/" → smart fraction on the last term.
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
