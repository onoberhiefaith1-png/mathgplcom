# Smart Table: lesson numbering, T-series floating numbers, Delete vs Clear

Two things are already in place from the last change: the table renders as an inline board object on its own lesson row with an auto-hiding toolbar, and the board is visually neutral (no ticks, crosses, marks or score) while the same validation logic runs silently into a hidden snapshot that is broadcast for the reasoning layer. This plan finishes the architecture around it.

## What is wrong today

- Lesson numbering is inflated by the table. The Floating Number panel counts every reservoir line (`lineCount = guidedLines.length`, `lineNumber = curLineIdx + 1`), and a table contributes one line per row/column. A five-line lesson with a 3-row table currently reads as 7 lines instead of 5.
- There is no T-series. Inside the table the panel still shows lesson numbers, so table rows appear as lesson steps.
- `Delete` destroys work: it wipes the table's cell entries and its expand state and permanently drops the object for the session.
- There is no `Clear`.

## 1. Lesson numbering collapses the table to one step

Introduce a lesson-step index layer on top of the reservoir lines, derived from the existing `buildTableGroups`:

- Each table group contributes exactly one lesson step (its anchor line). Non-table lines contribute one step each.
- The Floating Number panel and Present receive step count and step number from this layer, so the example lesson always reads 1, 2, 3 (Table), 4, 5 — regardless of how many rows the table has.
- Prev/Next stepping moves across lesson steps: stepping onto the table lands on its anchor line; stepping off jumps past all its member lines. Note gates, assessment and sensor logic keep using the underlying line index, unchanged.

## 2. T-series floating numbers while the table is active

- The table is one ordinary floating number line and shows as `Table label` in the panel when the lesson step is the table.
- Opening (expanding) the table does not activate the T-series. The table becomes active only when a cell is clicked.
- On cell click the system resolves table, orientation and row/column, and the panel switches to `T1 … Tn` — one T per member line, ordered as today (`memberLineIdxs`). `T` count comes from the group, not the lesson.
- Leaving the table (moving to another lesson step, or collapsing/closing it) immediately restores lesson numbering 1…5.
- Present Mode uses the same switch: the table line is a normal line; clicking inside a cell puts Present on the T-series; leaving restores lesson numbers.
- Orientation still decides what a T represents: row-oriented → one T per row; column-oriented → one T per column. No change to generation.

## 3. Assessment follows the active track

Unchanged logic, driven from the hidden validation snapshot: `Expected Row 3 — incomplete` when row-oriented, `Expected Column 2 — incomplete` when column-oriented, updating as the active cell changes. Feedback appears only in the reasoning/assessment surfaces, never on the board.

## 4. Delete means "remove from this board view"

`Delete` on the table toolbar hides the table object from the current Smartboard view only. It must preserve:

- generated floating numbers and the T-series
- orientation, retained cells, retained formulas and headings
- assessment mappings
- student cell entries and Smart Table configuration

The lesson steps past the hidden table, and the same table can be shown again later (a `Show table` affordance on the table's lesson step restores it). Nothing is deleted from storage.

## 5. New Clear action

Add `Clear` to the table toolbar. It removes every student-entered value for that table and nothing else: retained cells, retained formulas, headings, row/column structure, merges, formatting and orientation all stay. After `Clear` the table is exactly the object the teacher prepared.

## Everything that stays untouched

Smart Table editor, orientation, retention, cell calculator, Σ summation, expressions, AI Edit, formatting, existing synchronisation, and the Floating Number engine itself. This is an integration refinement only.

## Technical notes

- `src/lib/smartboard/tableActivity.ts`: add pure helpers — `lessonSteps(lines, groups)` returning the collapsed step list (step index ↔ line index both ways), `tSeriesFor(group)` returning the T labels/line indices, and `clearEntries(group, entries)` returning entries with only retained keys kept.
- `src/components/smartboard/PresentationView.tsx`:
  - derive `lessonSteps` and pass step-based `lineNumber` / `lineCount` to `FloatingNumberPanel`; make `stepTo` / `goPrev` / `goNext` walk steps, mapping to line indices.
  - add `tableActive` state (set on cell click / sensor cell inside the open table, cleared on step change or collapse); when set, pass the T-series count and index instead of the lesson step values.
  - change `deleteTableObject` to a `hiddenTables` set that only affects rendering — stop clearing `tableEntries` and stop deleting mappings; add `clearTableEntries` that keeps retained keys.
  - keep the hidden `tableValidation` snapshot in the live payload as-is.
- `src/components/smartboard/TableActivityStage.tsx`: add a `Clear` button next to `Expand/Collapse`/`Delete`, and keep the stage free of any correctness indicator.
- `src/components/smartboard/FloatingNumberPanel.tsx`: accept an optional label prefix so the counter can read `T2` instead of `2` while a table is active; no other behaviour change.
