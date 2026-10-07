# AI Edit — Mathematical Table Repair Engine

Goal: AI Edit repairs the SAME table so every calculated cell ends as Subcell working above the blue line and the result below — never a flat answer — and every Example (including Example 1) arrives that way from generation.

## What is wrong today
- The AI Edit preview is a hand-drawn flat table, not the real table, so the teacher sees `−4` instead of `2 − 6` over `−4`.
- Cells typed as `4 − 6 = −2` are treated as unreadable text, so the mean, the next column `(X − x̄)²`, and the completeness check all break on those rows.
- "Complete the table" always goes to the AI, even when the app's own calculator can fill every missing working instantly (and free).

## Changes

1. **Clean up mixed cells first (no AI).** Any cell written as `working = result` is split: working goes into its Subcell, result stays in the cell. Same for cells holding only working (`2 − 6`): the result is calculated and the working kept.
2. **Repair locally before calling AI.** On Send, the app first normalises the table, works out the mean, column roles and dependencies (x − x̄ → (x − x̄)², midpoint → fx → fx², cf, relative frequency, %, angle, y = rule), and fills every missing Subcell across ALL rows and columns. Correct existing working and teacher edits are kept. Only if problems remain (or the instruction is not a completion/check request, e.g. "change row 4 to x = 5") is the AI called — and the AI's answer still goes through the calculator check before it can be applied.
3. **Real table in the dialog.** The preview uses the same Smart Table display (Subcell, blue divider, result, Advance on) so what the teacher approves is exactly what lands. Changed cells are briefly highlighted; a "Table complete" / remaining-problems line shows the final check.
4. **Final quality check before Apply.** Apply is only enabled when: one table, same table kept, Advance on, every calculated cell has matching working, raw data unchanged. Otherwise the remaining items are listed.
5. **Same pipeline for every Example.** Run the same normalise → merge working/answer tables → derive Subcells → Advance on step on every generated table in every Example, so Example 1 cannot take a different path. Strengthen the generator instruction that every Example uses one table with working.
6. **Tidy the table toolbar.** Row, Column, Add Cell, Summation, Calculator, Advance, AI Edit grouped, aligned, equal height; AI Edit visually marked as the smart action. No functional change.

## Acceptance tests (automated)
- X = 2, 4, 7, 8, 9, mean 6: every `X − x̄` shows `2 − 6 / −4` … and every `(X − x̄)²` shows `(−4)² / 16` …
- The mixed table from the brief (`−4`, `4 − 6 = −2`, …) + "Complete the table" → all rows consistent, no AI call needed.
- Grouped frequency: midpoint `(10 + 19) ÷ 2`, fx `4 × 14.5`, fx² `4 × 14.5²` on every row.
- Two-table Example 1 output collapses to one table with Advance on.

## Credits
Local repair costs nothing. Only instructions the calculator cannot complete call the AI (uses AI credits); I will flag any test call that spends credits.

## Technical details
- `deriveSubcells.ts`: add `normalizeTable(headers, cells, subcells)` (split `a = b`, evaluate working-only cells); `deriveSubcells` and `tableProblems` run on the normalised table; export `repairTable()` returning `{headers, cells, subcells, changed, problems}`.
- `TableAiEditDialog.tsx`: replace `Preview` with the SmartTable read-only renderer; local `repairTable` first, `notebook-ai` `table_edit` only as fallback; gate Apply on final check.
- `aiToNodes.ts` / `notebook-ai` table post-processing: apply `normalizeTable` + `mergeWorkingTables` + derive uniformly to all examples; `advanced: true`.
- `SmartTable.tsx`: toolbar layout only.
- Tests in `deriveSubcells.test.ts` and `aiTableGeneration.test.ts`.
