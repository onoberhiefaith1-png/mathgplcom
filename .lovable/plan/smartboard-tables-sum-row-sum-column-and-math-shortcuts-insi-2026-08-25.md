# Smartboard tables: Sum Row + Sum Column, and math shortcuts inside cells

Scope: the table object on the Smartboard (the one shown in the screenshot). No change to lesson-note tables, marking, or the evaluation panel.

## 1. Sum Row and Sum Column

Today the table's control strip underneath the grid shows a single Σ button labelled "Sum row" / "Sum column" depending on the table's orientation, and that strip fades out after about 5 seconds, so it often looks like it is missing.

New behaviour:

- Two separate controls: **Σ Sum Row** and **Σ Sum Column**, both always available regardless of orientation.
- Sum Row: adds every numeric cell in the active row and writes the total into the first empty cell of that row.
- Sum Column: adds every numeric cell in the active column and writes the total into the first empty cell of that column.
- Retained (teacher-filled) cells count towards the total; empty and text cells are ignored; totals overwrite an existing total when re-run.
- The control strip stays visible while the table is open and a cell is selected, instead of disappearing after 5 seconds, so the two Σ buttons are reliably reachable during a lesson.

## 2. Three shortcut keys work inside table cells

Board table cells are currently plain text inputs, so `@`, `#` and `/` are typed as ordinary characters (which is why `@SQ`-style text can appear). They will use the same universal math editor the lesson-note cells already use:

- `@` — opens the Asset Library picker at the caret (symbols, structures, favourites/recents). Whole-page objects (diagrams, charts) stay non-insertable inside a cell.
- `#` — superscript (exponent); `##` — subscript. Further presses navigate between the slots exactly as elsewhere.
- `/` — smart fraction, with the caret landing in the numerator.
- Full nesting, roots, smart brackets, Enter to commit and evaluate, Tab to move to the next editable cell — all unchanged from existing behaviour.

Committed cells keep rendering through the same math renderer, so the grid on the board, the Evaluation panel grid and cell-aware marking all continue to read the same values as before.

## Technical notes

- `src/components/smartboard/TableActivityStage.tsx`
  - Replace `sumIntoTrack()` with `sumTrack(orientation)` that resolves the active row/column from `parseCellKey(sensorCell)` (falling back to the active line), sums with `cellNumber`, and writes with `formatNumber` via `onEntry`.
  - Render two toolbar buttons; keep the auto-hide `ping()` behaviour but hold the strip open while `open && sensorCell`.
  - Swap the editable `<input>` for the shared `MathInlineCanvas`-based cell editor (same pattern as `MathCellEditor` in `smarttable/SmartTable.tsx`): store LaTeX-lite through `treeToLatex`/`latexToTree`, evaluate with `tryEvaluate` on Enter, keep `data-sb-cell` attributes and `focusCell` / `moveWithin` wiring so the board's sensor and per-track grading are untouched.
  - Extract the cell editor into a small shared component so both tables use one implementation.
- No database, schema, or marking-logic changes.
