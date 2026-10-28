# A table stays a table: Note → Floating → Smartboard → Evaluation

The table engine, retention model and row/column assessment already exist. This plan closes the broken joints so a table never degrades into loose text, and its cell coordinates survive every stage.

## 1. Floating shows ONE table object

On the Generated Floating Numbers page a table currently appears as several numbered lines (one per row/column) with chips. Change the presentation only:

- The table occupies a single numbered floating item, shown with a table icon and the label `TABLE` (plus its name when the teacher gave one).
- Clicking it opens the complete table workspace (the grid, orientation, Generate, Retention, + Add Line) exactly as today.
- Row/column tracks stay inside the table as its internal T-series (T1, T2 …) — they are no longer separate top-level floating numbers, and no per-cell floating chips are ever produced.
- Numbering for everything after the table follows from one item, not N.

## 2. Headings retained by default

Header cells are retained the moment a table enters Floating, so `x`, `y`, `S²` always appear for the student. The teacher can still retain or release any data cell; releasing a heading stays possible but is never the default.

## 3. Retention is a coordinate, not a value

Retention is already stored as `r:c` cell keys; the plan keeps that and removes any place where retained cells are compared or rebuilt by value. A retained `3` at row 1 / column 1 is never confused with a `3` elsewhere.

## 4. Smartboard actually draws the table

When the teacher reaches the table item, the board renders the teacher's grid — the exact row and column counts from the Lesson Note, retained cells read-only in their original positions, every other cell blank and answerable. No new table is generated, no values are written as free ink lines on the board. Students can only type into empty cells: no adding/removing rows or columns, no resizing, no moving cells.

## 5. Evaluation becomes cell-aware and draws the table

- The expected answer for a table track is stored and shown as a table, not as the string `3 4 Q`. The Evaluation panel renders the expected grid with values in their correct cells, next to the student's grid, compared cell by cell.
- A mark is awarded when the required cells of the assessed row (row-oriented) or column (column-oriented) hold the correct values in the correct positions.
- Values written anywhere outside the table never satisfy a table track — free ink is not accepted as a table answer.
- Row means `(1,1) → (1,2) → (1,3)`; column means `(1,1) → (2,1) → (3,1)`, taken from real coordinates, never inferred from visual arrangement.

## 6. Superscript symbol fix

The header currently shows raw `x^{2}`. Table cells render mathematics through the existing math renderer, so `S²`, `x²` and fractions display properly and identically in the Lesson Note, Floating, Smartboard, student view, evaluation and expected answer.

## 7. Identity through every stage

Table id, row/column counts, cell coordinates, values, headings, retained set, orientation and marks travel as one object from note to evaluation. Nothing re-derives a table from text.

## Technical notes

- `src/lib/lessonnotes/floatingCompile.ts` — mark table-derived lines as internal tracks of one owning object (`tableObjId`, `trackIdx`) instead of standalone floating numbers; keep the grid snapshot on the ref.
- `src/pages/FloatingNumbersPage.tsx` + `src/components/floating/TableWorkspace.tsx` — render one numbered `TABLE` entry per table object; move the generated tracks inside the workspace; seed `retained` with header keys on first entry.
- `src/lib/smartboard/tableActivity.ts` — one lesson step per table (already the case) plus expected-answer output as a grid (`{rows, cols, cells, retained}`) rather than a joined string; keep `isCellCorrect` coordinate-keyed.
- `src/components/smartboard/PresentationView.tsx` / `TableActivityStage.tsx` — guarantee the table group renders the grid for the active track and suppress the free-text write path for table lines; enforce structure-locked student input.
- `src/components/smartboard/TeacherReasoningPanel.tsx` — when the active line belongs to a table, replace the `EXPECTED LINE` / `STUDENT LINE` text rows with expected vs student grids and per-cell status; grading for table tracks ignores board ink.
- Cell rendering goes through the existing math renderer (`mathStructureLatex` / unicode math) so `x^{2}` never surfaces.
- No database migration: retention, orientation and grid already persist in `notebook_subsections.floating_highlights`.
