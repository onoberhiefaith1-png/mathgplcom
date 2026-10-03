# One live table: merge the working into the same cells

## What is wrong now
The table itself can already hold working above the answer in the same cell, with a blue line between them. The second table in your screenshot comes from Copilot. It writes the working as one table and the answers as another, and only knows how to fill working for midpoint, fx, x² and fx² columns. Columns such as x − x̄ and (x − x̄)² get no working, so the two tables stay separate.

## What will change

1. **Copilot makes one table only**
   - Copilot's instructions will say: one table. Working goes in the Subcell and the answer goes in the normal cell. Never write a separate working table or answer table.
   - Safety net: if Copilot still writes a working table followed by a matching answer table (same headings, same size, and each working line gives the answer), the two are joined into one table with Subcells. The extra table is removed.

2. **Working for deviation columns**
   - x − x̄ gets working like "85 − 80". The mean is read from the solution, or worked out from the x column.
   - (x − x̄)² uses the answer already worked out: "5²", or "(−10)²" for negatives. It does not repeat "(85 − 80)²".
   - f(x − x̄)² gets working like "3 × 25".
   - Every piece of working is checked against its answer as before. Answers never change, and direct data such as x gets no working.

3. **Cleaner table controls in the lesson note**
   - Buttons in order: Row / Column, −, +, Σ, Add Subcell, AI Edit, Advance.
   - All buttons have a white background with blue text and icons. Advance is filled blue while it is on.
   - The dark Edit button at the end is removed. Table settings stay reachable from the right-hand Properties Panel.
   - Advance is always shown, and is on by default.

4. **Smartboard and phones**: no redesign. A quick check that Calculate, Σ and Advance still work on the joined table and that a wide table scrolls sideways.

## Technical details
- `supabase/functions/notebook-ai/tableStandard.ts`: add the ONE TABLE rule to the table standard, and add `mergeWorkingTables()` to join a working/answer table pair, using the existing evaluator to check each row.
- `src/lib/lessonnotes/ai/materializeDirectives.ts`: run the merge before `deriveSubcells`, and pass the mean x̄ found in the nearby solution text.
- `src/lib/lessonnotes/ai/deriveSubcells.ts`: recognise the `x−x̄`, `(x−x̄)²` and `f(x−x̄)²` headings, plus the variants written with `\bar{x}` and `μ`. Add tests to `deriveSubcells.test.ts` for the 80, 85, 70 … example.
- `SmartTable.tsx` toolbar: restyle the buttons, remove the Edit toggle (the settings panel opens when the table is selected), and always show Advance.
