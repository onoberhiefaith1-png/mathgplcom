# Final fix: one Subcell table + Smartboard Subcell workflow

Floating Number Generation page, palette, Advance behaviour and table architecture stay untouched.

## 1. Lesson Note: only the interactive Subcell table
- When Copilot writes a static "working" table (cells like `3 − 7`, `(−4)²`) next to the answer table, fold it into the Subcell table and drop the static one. Today this merge only runs when the tables are adjacent and empty; widen it to any same-header pair in the same Solution, in either order.
- Strengthen the ONE TABLE LAW in the Copilot instructions: never write a separate working table, never repeat the table in the written solution.
- If a static table already has working in its cells but no answer table, convert it: working becomes the Subcells, answers are calculated into the normal cells.

## 2. Smartboard: input goes into the selected Subcell
- Tapping a Subcell makes it the only input target. Floating numbers, typing and the keypad write into that Subcell, never into the normal cell below.
- Tapping a normal cell (below the blue line) or a row/column switches back to normal input.

## 3. Focused view when a Subcell is selected
- The full table is hidden from the working area; only that Subcell's expression shows, large, using the existing floating-number mode with that Subcell's own numbers.
- A Back button and tapping any normal cell return to the full table, with all entered work kept.

## 4. Calculate
- Works out the active Subcell, keeps the expression in the Subcell, and writes the answer into the normal cell underneath.
- Handles negatives, brackets, powers, roots, decimals and fractions (`(−4)²` gives 16, `3 − 7` gives −4); the answer is shown in normal maths formatting.

## 5. Evaluator
- While a Subcell is active, its expected line is that Subcell's expression (for example `3 − 7`), so marking and the predicted line follow the Subcell. Back in table mode, the existing row/column expected lines come back.

## 6. Check
- Automatic tests: duplicate-table merge (X = 3, 5, 7, 9, 11, mean 7), Subcell input routing, Calculate keeping the expression, Back restoring the table.
- Open it in a browser where sign-in allows, and report exactly what was and wasn't seen.

## Technical details
- `src/lib/lessonnotes/ai/deriveSubcells.ts` `mergeWorkingTables`: match by header signature, non-adjacent; static cells like `3 − 7` become `subcells[r:c].expr`, answers from `tryEvaluate`.
- `supabase/functions/notebook-ai/tableStandard.ts`: tighten the rule; redeploy notebook-ai.
- `src/components/smartboard/TableActivityStage.tsx`: `activeSub` owns input routing (writes `entries["sub:"+k]`); focused-expression render branch while `activeSub` is set; Back clears `activeSub`; Calculate writes `onEntry(k, solved)` and leaves `sub:k`.
- `PresentationView.tsx` / `tableActivity.ts`: expected line follows `subcellLineForCell(activeSub)`.
- No changes to `FloatingNumbersPage.tsx` or the floating compile code.
