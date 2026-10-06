# Table Subcell consistency: Lesson Notes, then Floating Numbers, then Smartboard

This is a consistency fix, not a redesign. The current Subcell, Advance, Row/Column, Floating Number and Calculate behaviour stays the reference. Palette, styling and the Floating Demo stay as they are.

## What the code does today
- Copilot tables only get working (Subcells) for a fixed set of column headings: midpoint, fx, x², fx², x − x̄, (x − x̄)² and f(x − x̄)². Any other calculated column (cumulative frequency, percentage, relative frequency, pie-chart angle, y-values in a table of values, and so on) comes out with no Subcells. That is why some tables have them and some don't.
- When one row's working doesn't reproduce its answer, only that row loses its Subcell. That leaves gaps inside a column.
- Working is only added on one generation path. Tables that come in another way, or that are converted from hand-typed tables, can miss it.
- The Smartboard already has Advance (on by default), one active Subcell, Subcell-only floating lines and Calculate for the active Subcell. It just needs checking against your acceptance test.

## Stage 1 — Lesson Notes (main work)
1. **Classify each column once:** it is either *raw data* (the values come from the question) or *calculated* (worked out from other columns or a known value such as the mean). Raw columns never get Subcells. Calculated columns get one in every row.
2. **Add the missing calculated column kinds**, all checked against the answer:
   - cumulative frequency (previous total + f)
   - relative frequency / probability (f ÷ Σf), percentage (f ÷ Σf × 100)
   - pie-chart angle (f ÷ Σf × 360)
   - table of values: y for a given rule, e.g. 2(3) + 1
   - class width / class boundaries where they are derived
   - x − a style deviations with an assumed mean, and |x − x̄|
3. **Whole-column rule:** if a column is calculated, every row gets its working. If any row's working doesn't give the answer, report a table violation so Copilot rewrites it. It must not save a column with gaps. The answers themselves are never changed.
4. **One path for every table:** directive tables, converted hand-typed tables and merged working tables all go through the same Subcell step, with Advance on.
5. **Copilot instruction:** tell Copilot which column headings it should use and that it must not repeat table working in the written solution below the table.

## Stage 2 — Floating Numbers (protect what works)
- Make no changes to the engine or the palette. Add tests that pin today's behaviour: a normal cell gives its Row and Column lines; a Subcell gives only its own lines, with no Row/Column values mixed in.

## Stage 3 — Smartboard (check and fill gaps)
- Run your acceptance table (X = 5, 7, 8, 10, 10; μ = 8) through the Smartboard flow and check each point: X has no Subcells; every row of X − μ and (X − μ)² has one; tapping a normal cell shows Row/Column; tapping a Subcell gives it the blue highlight, makes it the only active one and shows its own floating context; Calculate solves only that Subcell and puts the answer in the cell below; results stay; Advance off goes back to the normal table.
- Fix only the steps that fail. Use the same table data everywhere, with no second table model.

## Technical details
- `src/lib/lessonnotes/ai/deriveSubcells.ts`: add a `classifyColumns(headers, cells)` step (raw vs calculated, using heading patterns plus whether values can be rebuilt from other columns), new derivers, and a `subcellViolations()` that returns columns with gaps.
- `supabase/functions/notebook-ai/tableStandard.ts`: add the column vocabulary and the "no duplicate working below the table" rule. Feed `subcellViolations` into the existing table-violation rewrite.
- `materializeDirectives.ts` / `aiToNodes.ts`: send every smarttable through the same derive step.
- Tests: extend `deriveSubcells.test.ts` with the acceptance table and each new column kind. Add floating-context tests for normal cells vs Subcells in `src/lib/smartboard/tableActivity.ts`.
- Check in the browser with Playwright on a Smartboard table, if I can get a signed-in session. Otherwise I'll say clearly that it wasn't checked.
