# Make Smart Structures flexible: erase, consistency, and navigation

Structures work but behave rigidly. Three things to fix: the eraser cannot touch values inside a structure, structures appear/disappear inconsistently, and a question that is drawn as an asset (your binary conversion in Example 2) never becomes a beat, so Next stays disabled.

## What changes for you

1. **Eraser works inside structures and tables**
   - Dragging the eraser over a number you (or a student) typed inside a long division, ladder, base conversion or place-value chart clears that value in place.
   - Retained content — the bracket, the slash, the horizontal rules, the minus signs, the ladder divider, the `R` labels, and any value the teacher marked retained — is read-only ink and the eraser passes straight over it.
   - Full erase for the object stays available on the object toolbar: **Clear** removes every entered value (structure untouched), **Remove from board** takes the whole object off the board. Nothing else can wipe the structure.

2. **Consistent appearance — no self-generating structures**
   - A structure appears on the board only when you tap its Floating Number icon, and stays until you remove it. It never pops up on its own when the cursor happens to cross its lesson line, and it is not auto-expanded behind your back.
   - Placement, expansion and entries survive cursor movement, section changes within the same reservoir, and re-placing the same object.
   - No solution is auto-generated for a structure: empty editable cells stay empty until you or a student write into them.

3. **Every structure maps to rows and columns while keeping its look**
   - Place-value chart, column addition, long multiplication and base conversion all use the same adapter path as long division, so each is addressable as rows/columns for Floating Numbers while still being drawn by its own asset.
   - Row/column orientation, Generate and Retention behave identically for all of them, and a cell click activates the floating numbers of that row/column.

4. **Next button reaches Example 2**
   - A question that exists only as an asset (a base-conversion / binary table with no typed question text) currently produces no lesson beat, which is why Next is disabled after Example 1. Asset-only questions will produce a beat, so Next moves through Example 2, Example 3, and so on.

## Technical notes

- `PresentationView.eraseAtPoint`: add a branch that resolves `[data-sb-cell-key]` / `[data-sb-table-object]` under the pointer, and calls `setTableEntry(objId, key, "")` when the cell is not in `group.retained` and not in `grid.staticCells`. Retained/static cells return early (no-op), so structure ink is never removable.
- `StructureStage` + the four arithmetic assets (`LongDivision`, `DivisionLadder`, `BaseConversion`, `PlaceValueChart`) in `board` mode: stamp each value field with `data-sb-cell-key={r:c}` so the eraser and the caret→cell mapping use one explicit address instead of DOM reading order (which is what makes activation fragile today).
- `presentation.ts buildBeats`: replace the hard `if (!problem) continue;` with a fallback that accepts a subsection whose `problem` block carries an object/asset (or whose objects list is non-empty), using the asset label as the beat caption content. Reservoirs stay in step with beats.
- `structureGrid.ts`: confirm `placevaluechart`, `baseconversion` and the column-arithmetic ids all resolve through `structureIdOf`, and add adapters for column addition / long multiplication ids if the asset ids are present but unmapped.
- `PresentationView` table state: keep `placedTables` / `expandedTables` keyed by `objId` and stop clearing them on reservoir change unless the reservoir truly differs; ensure `activeTableObjId` changes never mutate placement (visibility is teacher-driven only).
- No schema changes; all state already lives in `content_json` plus board-local session state.
