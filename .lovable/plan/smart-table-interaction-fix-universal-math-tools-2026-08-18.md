# Smart Table — Interaction Fix + Universal Math Tools

Improve the existing Smart Table's interaction layer and make it use the same mathematics editor as the rest of the workspace. The calculation engine, table model, styling and Properties Panel stay as they are.

## What changes for the teacher

1. **One click activates a cell.** Today a cell only opens when the click lands exactly on its text; clicking the padding just soft-selects it. Any click inside a cell will open it for typing, and the caret lands where the click happened.
2. **No dotted placeholders.** The grey `·` in empty cells and the `header` hint stay out of the way (empty cells are simply blank; header hint kept as very faint text only while the table is selected).
3. **No cell wash / overlay.** The blue-green background wash on soft-selected and row/column-selected cells is removed. Row and column selection is shown only by the small handles at the edge of the table, so the table stays a clean white grid.
4. **One sensor only.** While a Smart Table cell is being edited, the lesson-note Master Sensor caret is hidden, so there is never a second blinking pointer on the page.
5. **All mathematics tools work inside cells.** Cell editing switches from a plain text input to the same interactive math canvas used in lesson-note lines, so inside a cell the teacher gets:
   - `/` → stacked fraction (numerator/denominator both editable)
   - `#` / `##` → superscript / subscript (indices, powers, `x₁`)
   - `(`, `[`, `{`, `|` → smart brackets
   - roots, nested structures, arrow-key navigation into and out of every region
   - Space/Tab exits one level, Enter/Escape commits the cell
6. **Keyboard navigation preserved.** Enter commits the cell, Tab commits and moves on, Escape cancels.
7. **Calculation engine untouched.** On commit the cell value is evaluated exactly as today: pure arithmetic is solved (`=` cells and plain expressions), while anything algebraic or symbolic is preserved as mathematics and rendered, not flattened to text.
8. **Cell toolbar (Copy / Cut / Delete / Duplicate / AI Edit) keeps working** on the cell's contents.

## Technical notes

- `src/components/lessonnotes/extensions/visuals/smarttable/SmartTable.tsx`
  - Replace the local `InlineEditor` (`<input>`) with a small `MathCellEditor` wrapper around the existing `MathInlineCanvas` (`src/components/lessonnotes/extensions/MathInlineCanvas.tsx`). It holds a `Row` tree parsed from the cell's stored value with `latexToTree(normalizeMathSource(value))` and writes back `normalizeMathSource(treeToLatex(next))`, so storage stays the same LaTeX-lite string the display renderer (`renderMathInline`) already uses. No new math engine, no second renderer.
  - `MathInlineCanvas` already maps Enter/Escape/Tab-at-top to `onBlur`; commit runs through the existing `finishEdit`.
  - `finishEdit` calls `tryEvaluate(latexToFriendly(raw))` so `2+3`, `√9`, `3²` still solve while `\frac{a}{b}`-style symbolic content is preserved.
  - `handleCellClick`: drop the `data-cell-text` hit test — always begin editing; keep the clicked point so the caret lands there. Row/column insertion anchor still tracked internally (`softCell`) but no longer painted.
  - `lineHi`: remove the cell background wash entirely (keep the edge handle highlight).
  - Remove the `·` placeholder in the body cells.
- `src/components/lessonnotes/extensions/visuals/smarttable/SmartCell.tsx`: remove its `·` placeholder for consistency.
- `src/components/lessonnotes/DocumentEditor.tsx`: track whether focus currently sits inside an object editor (Smart Table cell / inline math canvas) via a `focusin`/`focusout` listener and pass that into `SensorCaret`'s `hidden` prop, so only one pointer is ever visible.

## Out of scope

No changes to the evaluator, table data model, Sum Row/Column tools, Properties Panel options, or the eraser/AI cell-protection rules.
