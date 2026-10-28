# Smart Tables as Smartboard Activities

Give a Smart Table two roles on the Smartboard: one lesson line at the lesson level, and a container of Floating Number lines inside itself.

## What changes for the student

1. A table occupies exactly one lesson step. The board shows a single card, e.g. `Statistics Table`, and nothing else for that step.
2. Clicking the card opens the table full-size, exactly as the teacher built it: same rows, columns, headers, borders, formatting and math structures.
3. Retained cells arrive filled and read-only. Every other cell is empty and editable.
4. Inside the table the student keeps full Smart Table power: cell editing, calculator on Enter, math expressions, Σ summation, and any future Smart Table tool.
5. When the last required row/column is complete, the table closes itself and the lesson advances to the next line automatically.

## Three controllers, one state

The active state is a single value: which Floating Number line of the table is live.

- Click a table cell -> row-oriented tables resolve the row, column-oriented tables resolve the column -> that Floating Number line becomes active -> Present and Assessment follow, and the row/column highlights.
- Change the Floating Number line -> the table sensor moves to the matching row/column and the first empty editable cell in it.
- Tap a value in the Present panel -> it is written into the cell that currently holds the table sensor -> Assessment re-evaluates.

Orientation is fixed at generation time and is part of the table definition. Students never change it.

## Assessment

Assessment is orientation-aware and follows the table's own lines, not the lesson lines.

```text
Row-oriented      Expected Row 3     Status Incomplete -> Complete -> Expected Row 4
Column-oriented   Expected Column 2  Status Incomplete -> Complete -> Expected Column 3
```

A row/column counts as complete when every non-retained cell in it holds a value accepted by the existing line check. Completion advances to the next expected row/column; the last one ends the table activity.

## Progress recovery

Reopening a lesson restores: the same table, the same active row/column, used and remaining floating numbers, Present state, and per-cell entries already made. Nothing restarts.

## Technical notes

Existing pieces reused as-is: `FloatingTableRef` (already carries `objId`, `orientation`, `cellKeys`, `retained`, `grid`), the reservoir/`guidedLines` model in `src/lib/smartboard/presentation.ts`, the floating channel and Present engine, and the line-check/reasoning engine.

- **Group table lines.** In `presentation.ts`, consecutive reservoir lines sharing `table.objId` collapse into one lesson step (a `tableGroup`: objId, label, orientation, grid, retained, and the ordered member line indices). The member lines stay addressable for the floating engine but no longer count as separate lesson steps for navigation or line status.
- **Lesson-line card.** In `PresentationView.tsx`, when the active step is a table group, render a compact table card instead of writing rows; nothing else writes to that step.
- **Interactive table stage.** Replace the read-only `TableStage.tsx` with an interactive stage that mounts the real Smart Table renderer in a student mode (structure locked; retained cells read-only; other cells editable) so calculator, expressions and Σ come from the existing Smart Table code rather than a copy.
- **Sync layer.** New `src/lib/smartboard/tableActivity.ts`: pure mappings `cellKey -> member line index` and `member line index -> cellKeys` derived from orientation via existing `parseCellKey`/`cellKey` helpers, plus completion checks per row/column. `PresentationView` holds one `activeTableLineIdx` and drives table sensor, floating panel and Present from it; Present insertion targets the sensor cell.
- **Assessment.** The orientation-aware expected row/column label and status feed the existing assessment surface for the duration of the table step; on final completion the board advances to the next lesson step.
- **Persistence.** Student cell entries plus active row/column persist under the existing board-scope key scheme (`boardKey(...)` in `boardScope.ts`), alongside the existing floating line index, so recovery uses the same mechanism already in place.
- Generic by construction: everything derives from grid + orientation + retention, so frequency, probability, function, matrix, truth and any future grid table work with no extra Smartboard code.
