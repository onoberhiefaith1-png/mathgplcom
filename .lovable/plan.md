# Plan — Manual "Highlight → Enter" floating numbers

Pure manual workflow on the Floating Preparation page. **No backend / AI changes** in this plan — the teacher decides every floating chip by highlighting.

---

## Workflow

1. Teacher highlights any span of text on a solution line (existing token-selection mechanism stays).
2. An **Enter** button appears next to AI Edit (and the **Enter** key also fires it) while a selection is active.
3. On press, the highlighted span becomes **one** floating chip. The system inspects what surrounds the highlight on that same line and, if a structure belongs to the highlighted atom, attaches that structure as an empty shell on the chip. The structure tokens stay in the source line so the teacher can highlight them next.

The teacher never has to highlight a structural symbol. Structure follows the atom it belongs to.

---

## Structural attachment rules

When the highlight ends, look at the characters **immediately to the right** (and for `√` / `d/dx`, immediately to the left) of the highlighted span on the same equation line.

| Highlighted span | Adjacent context detected | Chip emitted |
|---|---|---|
| `2` | `^…` follows (any exponent body) | `2^{□}` |
| `a` | `_…` follows | `a_{□}` |
| `f`, `g`, `h`, `θ`, `φ`, any single letter/Greek | `(` follows | `f(□)` |
| `f(x)`, `θ(x+2y)` (highlighted whole) | — | one chip rendered verbatim |
| `sin`, `cos`, `tan`, `log`, `ln` | `(` or argument follows | `sin(□)` etc. |
| `log` | `_…` then argument | `log_{□}(□)` |
| `√` or atom under a radical | radicand `(…)` or `{…}` follows | `√(□)` |
| `d/dx`, `∂/∂x` | `(` or bracketed body follows | `\frac{d}{dx}(□)` |
| `∫` | `… dx` tail on the line | `∫□ dx` |
| `lim` | `_{x→…}` follows | `lim_{□}(□)` |
| `|` … `|` (teacher highlighted only the inner atom) | flanked by `|` on both sides | `|□|` |
| anything else | no recognized structure | chip = highlighted text verbatim |

Notes:
- The attachment **only adds an empty shell**; the original structure body (exponent tokens, bracket body, radicand, subscript) is **left in the source line** so the teacher can highlight each piece as its own chip afterwards.
- If the teacher highlights the whole expression including the structure (e.g. `2^{x+5}`), no extra shell is added — it becomes one chip exactly as highlighted.
- Detection is local (same line, immediate neighbours only) — no cross-line inference, no AI call.
- Output passes through the existing `toUnicodeMath` / `isStillDirty` normalizer so chips render in classroom style (`²`, `√`, `□`, etc.) and never as raw LaTeX or `^`.

---

## UI changes (Floating Preparation page only)

- New **Enter** button placed immediately before the existing AI Edit button. Same height/style as AI Edit. Disabled (greyed) when no active selection.
- Keyboard: pressing **Enter** while a selection exists triggers the same handler. Shift+Enter still inserts a newline if any text input is focused.
- Toast on commit: "Added as floating chip" (or "Added with `^{□}` shell" when a structure was auto-attached, so the teacher knows what happened).
- Undo / Redo already supported — the new commit is a single undo step.

---

## Files touched

- `src/pages/FloatingPreparationPage.tsx` — add Enter button, keyboard handler, call promoter on commit.
- `src/lib/smartboard/manualFloatingPromoter.ts` *(new)* — pure function `promote(selectionText, lineText, selStart, selEnd) → { chipMarkup, attachedShell?: "power"|"subscript"|"bracket"|"radical"|"derivative"|"integral"|"absolute"|"limit" }`. All structural detection lives here; fully unit-testable.
- `src/lib/notebook/unicodeMath.ts` — small helper exporting the function-name list (`sin`, `cos`, `tan`, `log`, `ln`, `lim`, `∫`, `√`, `d/dx`, `∂/∂x`) shared with the promoter.
- `src/test/manualFloatingPromoter.test.ts` *(new)* — table-driven cases for every row in the rules table above, including the "highlighted the whole thing" no-op cases.

No changes to: backend edge functions, AI prompts, DB schema, routes, or other pages. AI Edit remains exactly as it is today and runs on top of the manually-created chips when the teacher wants to refine one.
