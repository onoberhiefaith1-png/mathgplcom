# Subcell fix: the Smartboard always stays the table

The board no longer switches to a separate screen when a Subcell is clicked. The full table stays on the board, and only the Evaluation panel changes, from the expected table to the expected line.

## 1. Remove the separate Subcell screen
- Delete the "Subcell mode" view on the Smartboard: the big blue box, the "← Back to table" button and the large isolated expression.
- Whatever is clicked (a normal cell, a Subcell, another row or column), the full table stays visible.

## 2. The active Subcell stays inside its own cell
- Clicking a Subcell marks it with the existing light-blue active outline, inside the table.
- Only one Subcell is active at a time. Clicking another one moves the outline. Clicking a normal cell brings back the normal Row/Column behaviour exactly as it works today.
- Typing and Floating Number taps go into that Subcell's working (above the blue line), shown at table size inside the cell.

## 3. Calculate / Enter
- Calculate, or Enter in the active Subcell, works out the expression and writes the answer into the normal cell below the blue line.
- The working stays visible, for example `2 − 6` above the line and `−4` below it. The full table stays on screen.

## 4. Evaluation panel follows the selection
- Normal cell selected: the panel stays as it is now (expected table / student table).
- Subcell selected: the panel shows only one line, "EXPECTED LINE: 2 − 6", with the student's working under it. There is no partial table, enlarged cell or copy of the table.
- The expected line comes from that same Subcell in the stored table. It is not a separate copy.
- Marking uses the existing equivalence check, so any mathematically equivalent working is accepted.

## 5. Unchanged
- Floating Number generation and normal Row/Column Floating Numbers stay as they are.
- Advance off still shows the normal table. Advance on shows Subcells above the blue line, as today.

## Checks
- Automated test: choosing Subcell `0:1` makes the evaluation feed expect the line `2 − 6`, and choosing a normal cell brings back the table feed.
- Browser check on a Smartboard table: click a normal cell, then a Subcell, then Calculate, and confirm the table never disappears.

## Technical details
- `TableActivityStage.tsx`: remove the `open && activeSub` block and the `!activeSub` gate on the grid. In the grid's Subcell region, render `MathCellEditor` inline for `subActive` (editable) and keep the `calculateActive` path. The Calculate button stays in the toolbar.
- Evaluation feed (PresentationView → `TeacherEvaluationPanel`): when `tableSensorCells[objId]` starts with `sub:`, send a line feed (`expectedAscii` = `subcells[k].expr`, student = `entries["sub:k"]`) with `table: null`. Otherwise keep the existing `TableValidation` feed.
- Add a small helper in `src/lib/smartboard/tableActivity` (`subcellEvalLine(group, sensorKey)`) with a unit test.
