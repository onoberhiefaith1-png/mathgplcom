// Keyboard productivity for math typing:
//   - Shift tapped alone → next character becomes superscript (Unicode).
//   - Ctrl tapped alone  → next character becomes subscript (Unicode).
//   - Opening brackets auto-pair: ( [ { |  with caret between; wraps a selection.
//   - Typing the matching closer just before an auto-paired closer skips over it.
//   - Backspace immediately after an autopair removes both.
//   - "/" converts the last mathematical term into the numerator of a fraction.

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
  armSuper: boolean;
  armSub: boolean;
  // Track most recent autopair for backspace-delete-pair behaviour.
  lastPair: { closerPos: number; closer: string } | null;
}

/** Walk backwards to find the last "mathematical term" ending at `pos`. */
function findLastTermStart(text: string, endInText: number): number {
  // text = full text of the current text node up to caret. Scan back.
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
          init: () => ({ armSuper: false, armSub: false, lastPair: null }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(key);
            if (meta) return { ...prev, ...meta };
            // Any doc change invalidates the pending "delete pair" tracking.
            if (tr.docChanged && prev.lastPair) return { ...prev, lastPair: null };
            return prev;
          },
        },
        props: {
          handleKeyDown(view, event) {
            const s = key.getState(view.state) as PluginState;

            // Bracket pairing on printable-char keydown. We handle it here
            // (not textInput) so we can also wrap selections cleanly.
            const ch = event.key;
            if (OPEN_CLOSE[ch] && !event.ctrlKey && !event.metaKey && !event.altKey) {
              // Shift is OK — "(" is Shift+9 on most layouts. But we must NOT
              // fire subscript on Ctrl+(...) etc.
              const { from, to, empty } = view.state.selection;
              const opener = ch;
              const closer = OPEN_CLOSE[ch];
              const tr = view.state.tr;
              if (empty) {
                tr.insertText(opener + closer, from, to);
                tr.setSelection(TextSelection.create(tr.doc, from + 1));
                tr.setMeta(key, { lastPair: { closerPos: from + 1, closer } });
              } else {
                // Wrap selection: keep it selected between the brackets.
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
              // Only operate within plain text-holding blocks.
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

            // Super/subscript arming via lone Shift / Control tap.
            // We arm on keydown of Shift/Control alone; on the NEXT keydown of
            // a printable character we intercept and insert the mapped glyph.
            if (s.armSuper || s.armSub) {
              // Ignore modifier-only keydowns (Shift/Control themselves) — we
              // only consume when a printable key arrives.
              if (event.key === "Shift" || event.key === "Control" ||
                  event.key === "Meta" || event.key === "Alt") return false;
              if (event.key.length === 1) {
                const map = s.armSuper ? SUPER : SUB;
                const mapped = map[event.key];
                const tr = view.state.tr.setMeta(key, { armSuper: false, armSub: false });
                if (mapped) {
                  const { from, to } = view.state.selection;
                  tr.insertText(mapped, from, to);
                  view.dispatch(tr);
                  event.preventDefault();
                  return true;
                }
                // No mapping → just disarm and let default typing happen.
                view.dispatch(tr);
                return false;
              }
              // Non-printable → disarm.
              view.dispatch(view.state.tr.setMeta(key, { armSuper: false, armSub: false }));
              return false;
            }

            return false;
          },
        },
        view(editorView) {
          // Track Shift / Control taps without any other key. Uses window-level
          // listeners scoped to when the editor has focus.
          let shiftDownAlone = false;
          let ctrlDownAlone = false;

          const onKeyDown = (e: KeyboardEvent) => {
            if (!editorView.hasFocus()) return;
            if (e.key === "Shift") {
              shiftDownAlone = true; ctrlDownAlone = false;
              return;
            }
            if (e.key === "Control") {
              ctrlDownAlone = true; shiftDownAlone = false;
              return;
            }
            // Any other keydown while modifier held cancels arming.
            shiftDownAlone = false;
            ctrlDownAlone = false;
          };
          const onKeyUp = (e: KeyboardEvent) => {
            if (!editorView.hasFocus()) return;
            if (e.key === "Shift" && shiftDownAlone) {
              shiftDownAlone = false;
              editorView.dispatch(editorView.state.tr.setMeta(key, { armSuper: true, armSub: false }));
            } else if (e.key === "Control" && ctrlDownAlone) {
              ctrlDownAlone = false;
              editorView.dispatch(editorView.state.tr.setMeta(key, { armSuper: false, armSub: true }));
            }
          };
          window.addEventListener("keydown", onKeyDown, true);
          window.addEventListener("keyup", onKeyUp, true);
          return {
            destroy() {
              window.removeEventListener("keydown", onKeyDown, true);
              window.removeEventListener("keyup", onKeyUp, true);
            },
          };
        },
      }),
    ];
  },
});
