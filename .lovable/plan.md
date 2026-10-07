# One authoritative table + AI Edit repair + Calculator

Goal: every table instruction produces exactly one interactive Subcell table, every worked-out cell has its working, and the teacher can repair any gap through a conversational AI Edit that changes that same table. Floating Numbers, Advance and the Subcell design stay as they are.

## 1. One table per instruction (fix the cause, not hide copies)
- Trace why Example 1 produces 2–3 tables while Example 2 produces one: the generator writes a plain table, then a "working" table, then the answer table, and only adjacent pairs get merged today.
- Each table directive gets one stable table ID when it is first created. Later stages (add calculations, add Subcells) update that table by ID instead of adding a new one.
- Merge rule widened: within one example/question, every table describing the same rows (same first column / same data) collapses into the final Subcell table — working goes into Subcells, extra copies are removed before the note is saved.
- Copilot's instructions restated: one table per instruction, never a static table followed by a calculated one.

## 2. Every worked-out cell complete
- Add the missing column kinds: midpoint from class interval (10–19 → (10 + 19) ÷ 2), fx using the midpoint (4 × 14.5), fx² (4 × 14.5²), and decimal results like 4200.25.
- Data from the question (intervals, frequencies) never gets working; every row of a worked-out column always does.
- Table check before the note is shown: one table, Advance on, every worked-out cell has working that matches its answer. If a cell fails, the app fills it from the column rule; if it still can't, Copilot is asked once to redo that table (connects the existing gap checker that isn't wired up yet).
- A clear "table complete / incomplete" state the app and AI Edit can read.

## 3. New AI Edit for tables
- AI Edit button opens a workspace that shows the current table exactly as it is, with a message box underneath: "What would you like me to change or complete in this table?"
- Teacher types naturally: "Complete the table", "Fix row 4", "Fill the fx² column", "Check for errors".
- The AI receives the table (headers, cells, Subcells, which cells are missing/wrong) and returns changes to that same table only. Every returned working is checked by the app's own calculator before it is accepted; existing correct work is kept.
- Teacher sees the proposed table, then Apply or Discard. Applying updates the same table — never adds one.
- The current row/column style controls are removed from AI Edit (they stay in the table's own toolbar).
- Teachers can still edit any Subcell directly by clicking it.

## 4. Calculator button
- Add Calculator to the table toolbar after AI Edit: Row/Column, −, +, Σ, Add Subcell, AI Edit, Calculator, Advance.
- It opens the existing Smart Calc tool next to the table; when a Subcell is selected, it can drop its result into that cell's answer. It does not replace the Subcell.

## 5. Same table everywhere
- Lesson Note, Floating Numbers, Smartboard and AI Edit all read the one stored table (no simplified Smartboard copy). Floating Numbers code unchanged.

## Checks
- Automatic tests: the grouped-frequency example (10–19 … 50–59, f = 4, 7, 10, 8, 6) gives every midpoint, fx and fx² row its working; a three-table Example 1 collapses to one table; AI Edit "complete the table" fills one removed cell and nothing else.
- Then a real signed-in run: generate the standard deviation lesson, check Examples 1 and 2 each show one table, then delete one working and use AI Edit "Complete the table".

## Technical details
- `deriveSubcells.ts`: add `midpoint` from interval text, fx/fx² resolving x via the midpoint column, wider merge in `mergeWorkingTables` (group by question band + matching first column, not adjacency); `tableComplete()` helper built on `subcellViolations`.
- `materializeDirectives.ts`/`aiToNodes.ts`: assign `tableId` attr on creation; dedupe by ID.
- `notebook-ai`: post-generation table validation; one regenerate pass for violating tables; new `mode: "table_edit"` taking table JSON + instruction, returning a strict JSON patch (cells/subcells), verified with `tryEvaluate`. Uses the existing gateway setup; credit gate unchanged.
- `SmartTable.tsx`: AI Edit opens new `TableAiEditDialog` (table preview + prompt + Apply); Calculator button opens `SmartCalcView` bound to the active Subcell.
