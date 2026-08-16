# Responsive matrix object — measured brackets, live placeholders, attached functions

Make the matrix behave as one responsive mathematical expression: function + bracket + cells resize together from the actual rows/columns, and every cell is a real input position.

## 1. Brackets generated from the matrix, not a fixed glyph

Today the left/right brackets are text characters (`(`, `[`, `{`, `|`) whose size is guessed from a font-size formula based on the row count, which is why a 3x3 or 3x4 matrix shows a bracket that looks too small and detached.

Replace them with brackets drawn from the measured size of the cell block:

- Measure the cell grid (height and width) after render and on any change (dimension change, value typed, nested fraction inside a cell, font/zoom change).
- Draw each bracket as a shape sized to that exact height: curved for parentheses, square corners for brackets, curly for braces, straight rule for vertical bars.
- Bracket sits flush against the cell block with a fixed small gap, so 2x2 is short, 4x3 is tall, 3x4 is wide, and the bracket never separates from the numbers.
- Vertical growth comes from the row height total; horizontal growth comes naturally from the column widths plus cell spacing.

## 2. Placeholders that are the input positions

- Creating an `r x c` matrix creates exactly `r * c` cells, so 3x3 shows 9 placeholders immediately.
- Every empty cell shows a faint placeholder box at all times while the matrix is being filled — not only when the matrix has focus (current behaviour).
- A cell's placeholder disappears as soon as a value is typed and returns if the value is deleted.
- Placeholders are presentation only: never part of the saved note, exported document, or anything sent to the AI.

## 3. Input flow

- Typing `43` then Enter moves the caret to the next cell (left to right, then next row). Enter in the last cell leaves the matrix and continues after it.
- Tab / Shift-Tab keep working as next/previous cell; arrow keys keep current behaviour.
- Clicking or tapping any cell puts the caret in that cell, and Enter from there continues the normal flow from that position.
- When Matrix Power is selected, the exponent cell is the last stop in the flow.

## 4. Functions stay attached

- Transpose / inverse / conjugate-transpose superscripts are anchored to the top-right corner of the measured bracket, so they sit on the bracket rather than floating beside the first row.
- `det`, `adj`, `tr`, `rank` are vertically centred on the bracket height and sit directly against the opening bracket.
- Norm bars and the conjugate overline are measured from the same box as the brackets, so they span the whole matrix.
- Combined functions merge into one expression (for example `det((A)^-1)^T` notation) and reposition together whenever the dimension changes.

## Technical notes

- `src/components/lessonnotes/extensions/MathStructure.tsx`: matrix branch keeps the CSS grid for cells, but wraps the cell block in a measured container; a `ResizeObserver` on that container feeds `--mx-h` / `--mx-w` CSS vars used by the new bracket elements. Brackets become real `<span>`/inline-SVG decorations placed in the existing `--mx-lb` / `--mx-rb` columns, replacing the `::before` / `::after` glyphs.
- `src/styles.css` lines ~853-875: drop the `font-size: calc(0.9em + 0.62em * var(--matrix-rows))` bracket sizing and the `content:` glyph rules; add measured bracket, superscript-anchor, norm-fence, and overline rules driven by the measured height.
- `src/styles.css` lines ~676-684: matrix cell placeholders become always-visible (scoped to `.math-struct--matrix .math-slot[data-empty="true"]`), while other structures keep the focus-only placeholder.
- `MathStructure.tsx` `addKeyboardShortcuts`: add `Enter` handling that reuses the existing slot-jump logic for matrices (advance to next slot; escape after the last slot) without affecting other structures.
- No change to `matrixFunctions.ts` notation composition, `structureValidator.ts` slot counts, or the builder dialog result shape.
- Smartboard matrices (`MathTreeRender.tsx` MatrixView) get the same measured-bracket treatment so board and note render identically.
