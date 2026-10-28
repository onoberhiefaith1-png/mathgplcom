# Make inline math a true editing surface

Goal: a math expression behaves exactly like a line of text you can work inside — place the caret anywhere, select part of it, delete or push spaces, move text, retype, paste, and pull a term out of a fraction/exponent. No part of it should feel like a fixed picture.

## What is wrong today (verified in the code)

- The note body shows math with one engine (`renderMathInline`, the AI Edit renderer) and only switches to a second, different engine (`MathInlineCanvas`) once you click in. So what you see is not what you edit, and the visible gaps in the displayed version are layout padding — there is no character there to delete, which is exactly why backspacing a space does nothing.
- The editor has no selection at all: no shift+arrow, no drag-select inside the expression, no select-all. Without a selection there is no way to move, replace, cut or copy a piece of the expression.
- Missing text keys: forward Delete, Home/End, word-wise arrows, copy/cut/paste, and per-node undo/redo.
- There is no way to "push text out" of a structure. Backspace at the start of a numerator/exponent only hops the caret out; it never unwraps the structure or merges its content back into the parent row.

## What will change

1. One engine, always live
   - The tree canvas becomes the single display and edit surface for inline math, using the same typography tokens as AI Edit so nothing shifts when you click in.
   - Spacing becomes real: any gap you can see corresponds to an actual space character in the expression, so it can be deleted or added like text. Structural padding is reduced to hairlines that never masquerade as spaces.

2. Full text-style selection
   - Shift + arrows extend a selection; drag across glyphs selects a range; Ctrl/Cmd+A selects the whole expression.
   - Selected range is visually highlighted, and typing replaces it, Backspace/Delete removes it.

3. Move, replace and push text
   - Cut/Copy/Paste inside math (plain text and math fragments), so a term can be moved from one place to another.
   - Alt+Left/Right nudges the selected term one position left/right within its row.
   - "Push out": with the caret at the start of a numerator, denominator, exponent, subscript, radicand or bracket, Backspace unwraps the structure and merges its contents into the parent row (a second Backspace then deletes normally). Same result via a keyboard shortcut and an "Unwrap" action.

4. Standard text keys
   - Delete (forward), Home/End, Ctrl+Left/Right word jumps, Ctrl+Z / Ctrl+Shift+Z inside the expression.
   - Space keeps inserting a real, deletable space; Escape/Enter returns to prose; Tab still steps out one level.

## Technical notes

- `src/lib/smartboard/mathTree.ts`: add a `Selection` type (anchor + focus cursor), range-aware `deleteRange`, `replaceRange`, `insertFragment`, `moveNode`, plus `unwrapContainer` for push-out. Keep existing `insertChar`/`backspace`/`moveLeft`/`moveRight` signatures so other callers (Smartboard) are unaffected.
- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx`: hold `{cursor, anchor}` state, render selection highlight per glyph, extend `handleKey` with the keys above, add pointer drag hit-testing (reusing `hitTestCursor`), and clipboard handlers on the hidden input.
- `src/components/lessonnotes/extensions/MathInline.tsx`: drop the render/edit split so the canvas renders in both states; keep `value` + `tree` attributes in sync through `treeToLatex` on every commit, and keep `normalizeMathSource` on load and on AI Apply.
- Local undo history lives in the node view (bounded stack of tree snapshots) so it never fights the document-level history.
- `src/styles.css`: math typography tokens shared by display and edit states; selection tint class.
- Untouched: `renderMathInline` (still used by AI Edit preview, exports, previews and Smartboard read-only paths), 2D/3D diagrams, and all other toolbar features.
