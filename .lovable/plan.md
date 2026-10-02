# Calculation Subcells — Lesson Note to Student

A table cell can now carry two separate layers: the **normal answer** (what the table shows and what is marked) and an optional **Calculation Workspace** (the working a student builds to reach it). Everything starts in the Lesson Note. The existing table, Row/Column generation, Retention, Add Line and marking stay exactly as they are.

```text
Lesson Note table (answers + subcells)
   -> Generation page: Row | Column | Subcell
   -> Floating Numbers
   -> Student: pick answer, or open the cell's workspace and Calculate
   -> result drops into the answer cell -> existing marking
```

## 1. Lesson Note

- Clicking a table cell shows **Add Subcell**; a cell that has one shows **Edit Subcell** and **Remove Subcell**.
- The teacher types the calculation (e.g. `(1 + 3) / 2`) with the usual maths editor (`/` fraction, `#` power, roots). The expected result is worked out automatically and checked against the cell's answer; a mismatch shows a warning but never changes the answer.
- Display: calculation on top, a **blue divider**, the answer below. The whole row grows together so answers stay lined up; long expressions are never cut off.
- Subcells are optional and only exist where the teacher (or AI) puts them.

## 2. AI-generated tables

When Copilot writes a statistics-style table (midpoint, fx, fx², etc.) it also writes the subcell calculations for derived columns (e.g. `5 × 2²` for fx²), stored separately from the answers. Given columns (class interval, frequency) get none. The calculation must reproduce the answer, otherwise that subcell is dropped rather than shown wrong.

## 3. Generation page (Floating Numbers)

- Mode switch becomes **Row | Column | Subcell**, beside Generate, Add Line and Retention.
- Row and Column behave exactly as today and read only the normal answers.
- **Subcell** view keeps the headings, blanks cells that have no subcell, and shows each subcell's calculation. Generate in this mode builds one Floating Number set per subcell (e.g. `( 1 + 3 ) ÷ 2` split into its numbers and operators).
- Switching Column -> Subcell -> Column loses nothing; each layer keeps its own lines.

## 4. Student

- Clicking a normal cell works as now.
- Clicking a cell's workspace makes it the only active one (soft blue). Its own Floating Numbers appear; the full table fades back so the focus is the one calculation.
- The student builds the expression and presses the existing **Calculate / Enter**. Only the active workspace is calculated. The result is placed in that cell's answer area and the existing instant marking checks the answer.
- The working itself is saved with the attempt so teachers see it in View Student Work, but marks still come only from the answer.

## 5. Checks

- Worked example from your notes (standard deviation, class intervals 1–3 … 10–12): every midpoint, fx and fx² subcell generates, calculates and fills the right answer; Σfx = 115 and Σfx² = 839 still mark correctly.
- Tables without subcells, Row/Column generation, Retention and existing lessons behave unchanged.

## Technical details

- Storage: add optional `subcells: Record<"r:c", { expr: string; expected: string }>` to the Smart Table node attrs (`SmartTable.tsx`). Existing `cells` untouched; no database migration (stored in the note JSON).
- Editor: `SmartTableCellToolbar` gets Add/Edit/Remove; `SmartCell` renders the stacked layout reusing `MathCellEditor` and `renderMathInline`; expected value via the existing `evaluator.ts` / exact evaluation.
- Generation: `TableOrientation` gains `"subcell"`; `TableWorkspace` and `tableGrid.ts` expose a subcell grid; subcell lines are tagged `layer: "subcell"` with `cellKey`, spliced like table lines so numbering/marking keep working. Highlight payload stays additive in `floating_highlights`.
- Student: presentation rows carry the subcell mask; the board's Calculate action evaluates the active workspace expression with the existing math engine, writes the result into the answer filler, and fires the current instant-grading path.
- AI: `notebook-ai` table output schema gets an optional `subcells` field plus a verify-or-drop pass; question lock rules unchanged.
- Tests for subcell storage round-trip, mode switching preservation, generation splitting, and Calculate filling the answer.
