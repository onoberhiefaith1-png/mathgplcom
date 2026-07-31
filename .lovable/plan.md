# Insert real rows and columns inside a highlighted table

## What you want

When a cell (or a row/column) is highlighted in a Smart Table:

- **Add row** inserts one full empty row directly **below** the highlight, spanning every column.
- **Add column** inserts one full empty column directly **to the right** of the highlight, spanning every row.
- Everything after the insertion point shifts down / right — so in your example an empty column appears between `3.22` and `(3.22)²`, top to bottom.

Right now clicking those buttons in the Properties Panel produces no visible change.

## Diagnosis (to confirm first)

The insert helpers exist and are wired to the panel buttons, so the failure is in the interaction, not the maths. The most likely cause is that pressing a panel button drops the table's selection on mouse-down, which clears the highlight and unmounts the button before the click completes — so the insert never runs. This is unconfirmed; step 1 is to reproduce it in the browser and confirm before changing behaviour.

## Plan

1. **Reproduce and confirm** — drive the lesson note in a browser, highlight a cell, click Insert column → Right, and observe whether the handler runs and whether the highlight survives the click.
2. **Make the insert buttons survivable** — keep the panel's highlight anchor alive across the click (guard the deselect on mouse-down inside the panel, and keep the anchor in a ref so the handler always reads the latest row/column index).
3. **Simplify to one obvious action** — with any highlight active (cell, row, or column) the panel shows a primary **Add row (below)** and **Add column (right)**, matching what you described. Above/Left stay available as secondary options.
4. **Always full lines** — inserted rows get one empty cell per column, inserted columns get an empty header plus one empty cell per row, and column widths shift with them, so the grid never goes ragged.
5. **Keep the highlight after inserting** — the anchor moves with the content so you can insert several rows or columns in a row without re-clicking the cell.
6. **Verify** — insert a column between `3.22` and `(3.22)²` on the standard-deviation table, insert a row mid-table, confirm the new line is empty end-to-end, typing into it evaluates as usual, and the change persists after a reload.

## Technical notes

- All work in `src/components/lessonnotes/extensions/visuals/smarttable/SmartTable.tsx` (`addRow` / `addCol`, `softCell` / `line` state, panel groups) plus, if the deselect is the cause, the panel mouse-down handling in `src/hooks/useAssetSelection.tsx` / the properties-panel container.
- `addCol` must keep `cols`, `headers`, every `cells` row and `colWidths` in lockstep; `addRow` must build the blank row from the current `cols`.
- No schema or backend changes.
