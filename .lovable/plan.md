
# Redesign inline math from "fixed object" to "editable cursor region"

## Problem

`mathInline` is a TipTap `atom` node whose entire content is a LaTeX string edited only inside a modal chip. Once the chip closes, the whole expression is a single opaque object: you cannot click between characters, you cannot re-enter a superscript, `Delete` wipes the whole thing, and `S^2` + later `_{-1}` is impossible because there is no way to place the caret after the base `S`.

## Goal

Every `mathInline` becomes a small editable canvas — a **row of nodes with a real cursor inside it**. The cursor freely walks in/out of superscripts, subscripts, fractions, radicals, brackets. It only *becomes visually smaller* when it descends into a script/denominator/etc. Typing, Backspace, arrow keys, `#`, `##`, `/`, Space all operate on the cursor's current row, at any depth, at any time — including hours after the node was first created.

## Model

Reuse the tree already defined in `src/lib/smartboard/mathTree.ts`:

- `Row = Node[]`
- `Node = char | sup | sub | frac | sqrt | bracket | ...`
- `Cursor = { path: number[]; index: number }`
- Existing helpers: `insertChar`, `insertNode`, `backspace`, `moveLeft`, `moveRight`, `getRowAt`, `insertNodeWrapping`, `extractWrapTargetLeftOf`.

The math chip stops storing a LaTeX string as its source of truth. It stores a `Row` (serialized as JSON) in the node attr `tree`, and derives LaTeX (for prose export / re-render outside edit mode) from that tree.

## What changes

### 1. `MathInline` node

- Attributes: keep `value` for legacy read-only render, add `tree` (JSON of `Row`). New nodes write `tree`; on load, if only `value` exists, parse it into a tree once (`latex → tree` migration in `src/lib/smartboard`).
- Still `atom: false` conceptually — but implemented as a **ProseMirror atom with an internal contentEditable-off canvas** that owns its own cursor. This is simpler than making it a real nested ProseMirror node and matches how the smartboard already works.
- The node view is always interactive. There is no "editing mode / display mode" toggle. Clicking anywhere inside places the caret at that visual position; clicking outside blurs it. No modal chip, no "Done" button.

### 2. Rendering + hit-testing

New component `MathInlineCanvas`:

- Renders the tree as nested spans (`.mrow`, `.msup`, `.msub`, `.mfrac`, etc.) with the exact same visual rules the read-only renderer already uses. Each character span carries a `data-path` and `data-index` so `mousedown` maps a click straight to a `Cursor`.
- Renders a blinking caret element at the current cursor. Caret CSS scales with the row's depth class (`.depth-1`, `.depth-2`, …) so the caret naturally shrinks inside `sup`/`sub`/`frac` — the "cursor becomes smaller" behavior the user asked for.
- When not focused: no caret, no chrome, just the math. Same look as today.

### 3. Keyboard behavior (focused canvas)

All input is captured by a hidden input like today, but routed through tree operations:

- Printable char → `insertChar(root, cursor, ch)`.
- `Backspace` → `backspace(root, cursor)` (already deletes empty container/pops out, per existing helper).
- `ArrowLeft`/`ArrowRight` → `moveLeft` / `moveRight` (already walk in and out of containers character by character, including hopping between sup/sub sub-rows).
- `ArrowUp`/`ArrowDown` → move between sibling sub-rows of the same container when possible (numerator↔denominator, base↔sup↔sub); otherwise no-op. Small helper to add to `mathTree.ts`.
- `#` → wrap the run to the left of the cursor as `power` **only when the cursor is at the end of a valid parent object** (letter/digit/`)`/`]`/completed container). Cursor descends into the exponent sub-row. If pressed again immediately with an empty exponent, downgrade the `power` to a `subsup` and land the cursor in the subscript sub-row — this is how `S^{2}_{-1}` gets built.
- `##` → same but attach a subscript. If the previous keystroke was `#` on an empty script, replace `power` with `subsup` and jump to the sub row instead of nesting.
- `/` → `insertNodeWrapping(root, cursor, mkFrac(), start, end, 0)` where `[start, end)` comes from `extractWrapTargetLeftOf`. Cursor lands in denominator. The numerator remains a normal editable row — clicking inside it or arrow-lefting into it works exactly like any other row.
- `Space` → if the cursor is inside a nested sub-row, `moveRight` out one level (close-and-exit). If already at the top row, blur the canvas back to prose and let the outer editor insert a real space.
- `(` `[` `{` `|` → `insertNode(root, cursor, mkBracket(...))`, cursor descends into the body.

### 4. Prose-level `#`

`MathKeyShortcuts` no longer prebuilds `^{`. Instead:

- When `#` fires on a valid parent term, it wraps that term into a `power` tree, inserts a `mathInline` with `tree: <the row containing the power>`, positions the internal cursor inside the empty exponent, and focuses it.
- Cursors *between* two adjacent inline maths still work: clicking the caret between them focuses whichever one you clicked into. Clicking outside any math returns to prose.

### 5. Removal of the chip UI

`MathInlineView`'s "chip with hidden input + preview + tile row" goes away. Quick-symbol tiles move to a floating toolbar that appears when a math canvas has focus (same buttons, same behavior, but they now call tree ops).

### 6. Fraction editing after creation

Because the numerator is just a `Row` inside a `frac` node, clicking inside it moves the cursor there. Everything (typing, Backspace, `#`, `/`) already works via the same handler — no special "numerator locked" state exists in the new model.

## Migration

- Existing math nodes have only `value`. Add `latexToTree` in `src/lib/smartboard` (small parser covering the subset produced by `friendlyToLatex`: chars, `^{…}`, `_{…}`, `\frac{…}{…}`, `\sqrt{…}`, brackets, common commands like `\pi`, `\theta`, `\sum`, `\int`). Called lazily on first focus; tree is then stored on the node.
- `friendlyToLatex` / `latexToFriendly` remain the export path (tree → LaTeX for docx/read-only re-render, and for anything that still consumes `value`).

## Files

- `src/lib/smartboard/mathTree.ts` — add `moveUp`, `moveDown`, `latexToTree`, `treeToLatex` (thin wrapper over existing helpers).
- `src/components/lessonnotes/extensions/MathInline.tsx` — replace `MathInlineView` with a canvas node view backed by tree state; keep the TipTap node definition, add `tree` attr with JSON parse/serialize, keep input rules.
- `src/components/lessonnotes/extensions/MathKeyShortcuts.ts` — prose `#` builds a tree with an open exponent instead of a raw LaTeX string; `/` unchanged in intent but hands off to the new canvas; bracket pairing untouched for prose.
- New: `src/components/lessonnotes/extensions/MathInlineCanvas.tsx` — the interactive renderer + caret.
- Small CSS additions in `src/index.css` for `.mrow .depth-N` caret sizing.

## Out of scope for this pass

- Selection ranges inside math (highlight-and-replace across the tree). Only single-caret editing at first; multi-char selection can come in a follow-up.
- Copy/paste of a math subtree between chips.
- Touch drag to reposition the caret (tap-to-position works; drag-select is later).

## Verification

- Type `S`, press `#`, type `2`, press Space: caret returns to prose. Click just after the `S`: caret enters the base row. Press `##`, type `-1`, press Space: result renders as `S^{2}_{-1}`.
- Type `5x/`, then click inside the numerator, type `+1`: result renders as `\frac{5x+1}{}` with caret still in numerator; arrow-right hops to denominator.
- Click between the `2` and `n` in an existing `x^{2n}` (created hours earlier) and type `^3`: result `x^{2^{3}n}`.
- ArrowLeft from prose immediately after a math node enters it at its right edge; ArrowLeft again walks character-by-character into any inner sub-row.
