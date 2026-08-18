# Smart Table: clean cells + working Σ summation

Two targeted behaviour fixes. No redesign. Rows, columns, headers, cell editing, mathematics (fractions, powers, roots, brackets, asset functions), automatic calculation, the Edit control and the right-hand panel all stay exactly as they are.

## 1. Remove the floating cell action toolbar

The Copy / Cut / Delete / Duplicate / Comment / AI Edit bubble is currently rendered inside every cell (and every header cell) the moment that cell is being edited, so it follows the caret around the table and covers neighbouring cells.

It is removed completely: no toolbar on cell click, typing, cell-to-cell movement, cell selection, row selection or column selection. Cells stay clean; the caret simply moves.

One table-level **AI Edit** control stays in the existing control strip under the table (next to Row / Column / − / + / Σ / Edit). It acts on the currently selected cell's contents, so nothing is lost — there is just one AI Edit for the whole table instead of one per cell.

## 2. Restore Σ Summation

Σ → **Sum Row** / **Sum Column** enters the mode, the hint bar shows, then the teacher clicks the destination cell:

- **Sum Row** — every numeric cell to the left of the clicked cell in that row is added, and the total is written into the clicked cell (`2, 7, 9 → D = 18`).
- **Sum Column** — every numeric cell above the clicked cell in that column is added, and the total is written into the clicked cell (`2, 7, 9 → A4 = 18`).

The mode then exits. Escape or pressing Σ again cancels. No cell has to be selected by hand.
