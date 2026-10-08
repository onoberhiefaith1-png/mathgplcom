# Stop the duplicated table (keep the lower one)

## What I found in your lesson note
In Example 1 and Classwork 1 the note holds two tables with the same headings (x, x − x̄, (x − x̄)²):

- Upper table: working only (7 − 9, (−2)² …), 5 rows, x = 7 to 11.
- Lower table: the answers with the working inside the Subcells — but only 4 rows. The x = 11 row is missing.

The app already has a "one table" rule that joins a working table into its answer table, but it only joins tables with the **same number of rows** (or the same first column). Because Copilot dropped the last row from the answer table (5 rows vs 4), the rule skipped them, and both tables were saved.

## What will change
1. **Join tables with the same headings even when a row is missing.** If two tables in the same Example have the same headings and their rows match up by the first column (x values), they are joined into one table: the lower (answer) table is kept and the upper one removed.
2. **Recover missing rows.** Any row only in the upper table (here x = 11) is added to the kept table, with its working in the Subcell and its answer calculated (11 − 9 over 2, (2)² over 4). So you get one complete table, not a short one.
3. **Same check whenever a note is generated**, for every Example and Classwork, so Copilot cannot produce the pair again.
4. **Fix notes already saved.** When a lesson note opens, the same join runs once on any such pair and saves the result, so this note's Example 1 and Classwork 1 show one table without regenerating (no AI credits used).
5. The Example 2 / Classwork 2 case (a data table in the question, then the worked table in the solution) is left as it is, since the question needs its own data table. Tell me if you want that one joined too.

## Checks
- Automatic test using this exact table (upper 5 working rows, lower 4 answer rows) ends with one 5-row table, every row with working and answer.
- Existing table tests still pass.

## Technical details
- `src/lib/lessonnotes/ai/deriveSubcells.ts` `mergeWorkingTables`: match by equal normalised headers within the same section; align rows by first-column value instead of requiring `rows` equality; fold working into Subcells; append unmatched rows (evaluate working via `evalExpr`), update `rows`, then `repairTable`.
- Apply the same merge to stored solution/problem visuals (`objects` with same `sectionKey`) and to the TipTap doc when a note loads, saving once if anything changed.
- Test added to `deriveSubcells.test.ts`.
