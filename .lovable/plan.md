# Smartboard table cells stay put, and matrix / Σ / ∫ become real symbols everywhere

Two separate faults, both confirmed in the code.

## 1. The Smartboard table cell must not move by itself

What happens today: you put the sensor in a cell, type one character, and both the value and the sensor jump to another cell.

Two pieces of code move it:

- When the cells of a row (or column, under Column orientation) are all filled, the board immediately advances the active line to the next track, and a second effect re-seats the sensor onto the first open cell of that new track. In a two-column table where one cell is retained, typing a single character completes the track, so the jump happens on the first keystroke and the rest of what you type lands in the next row.
- When a cell editor commits, it walks the sensor one cell forward.

Fix — the sensor is teacher-owned, always:

- Remove the forward walk on commit. Committing a cell leaves the sensor exactly where it is.
- Remove the automatic line advance and the automatic sensor re-seating that follow track completion. The teacher chooses the next cell by tapping it, exactly as described.
- Keep marking untouched: a track is still assessed and awarded the moment its cells are complete (T1.1, T1.2, T1.3 each marked in turn). Only the movement is removed, never the marking.
- The sensor is seated once, when the table first opens (first editable cell of the active track), and after that only by a teacher tap, Tab/Enter within the row, or Σ Sum Row / Σ Sum Column placing a total.
- Branch exit stays available but becomes explicit: when every track of the table is complete the board no longer force-jumps; the existing Next control returns to the next main step (T1 → L4).

## 2. Matrix, summation, integral and friends are symbols, not text

In the lesson note the matrix renders correctly. On the Floating Highlighting page the same matrix shows as raw syntax (`\beginbmatrix2 & 1 \\ 3 & 4\endbmatrix`).

Cause: the solution is stored as one text line that holds the matrix as a bracketed environment. The highlighting page splits each line into tokens on spaces (brace-aware only), so the matrix is chopped into `\begin{bmatrix}2`, `&`, `1`, `\\`, `3` … Each fragment is rendered alone, the renderer cannot find the closing tag, and the fragments degrade into visible syntax.

Fix — one atomic-structure rule, shared by every surface:

- Teach the tokenizer about complete structures. A `\begin{…}…\end{…}` environment (matrix, pmatrix, bmatrix, vmatrix, Vmatrix, cases, aligned) is one indivisible token, as are `\sum_{…}^{…}{…}`, `\prod`, `\int`, `\oint`, `\lim`, `\binom`, `\sqrt[…]{…}`, `\vec`/`\overline`/`\hat`, `\left…\right` groups and `^{…}` / `_{…}` — the same family a fraction already belongs to. The token carries the whole structure, so it renders as one symbol and highlights as one unit.
- Apply that same reader on the Floating Numbers page and in the floating compiler, so a matrix or a summation becomes ONE chip with its structure intact instead of a spray of fragments.
- Let structures survive the display cleaners: the unicode pass currently strips braces at the end, which destroys any structure the classroom renderer needs. Matrices, big operators, limits and eval bars get held aside and restored whole, exactly as fractions already are, and the "still dirty" test stops rejecting them.
- Result: the Highlighting page is a photocopy of the lesson note — same stacked fractions, same brackets, same matrix, same Σ and ∫ — and the same objects reach the Floating Numbers page, the Smartboard and evaluation.

## Technical notes

- `src/components/smartboard/TableActivityStage.tsx` — drop `moveWithin(k, 1)` from the cell editor's `onCommit`; keep click/Tab focus.
- `src/components/smartboard/PresentationView.tsx` — in the track-completion effect keep the `gradeTableTrackRef` award and delete the `nextOpenLine` / `nextMainStepAfter` auto-jumps; restrict the sensor-seating effect to first open of a table (guard on a per-table "seeded" ref) instead of every `activeLineIdx` change.
- New `src/lib/notebook/mathTokens.ts` — `tokenizeMath(line)`, a brace/environment/structure-aware reader plus `readStructureAt`. Used by `FloatingPreparationPage.tsx`, `FloatingNumbersPage.tsx` and `src/lib/lessonnotes/floatingCompile.ts` in place of their local space splitters.
- `src/lib/notebook/unicodeMath.ts` — extend the existing fraction hold-out mechanism to `\begin{…}\end{…}` environments, `\sum/\prod/\int/\oint/\lim`, `\binom` and `\left…\right`, so the final `[{}]` strip cannot touch them; relax `isStillDirty` for those held structures.
- `src/lib/notebook/mathDisplayGate.ts` — allow the matrix/cases environment names and big-operator macros through the leftover-command check so `assertDisplaySafe` stops reporting them unsafe.
- Tests: unit tests for `tokenizeMath` (matrix, Σ with bounds, ∫ with limits, nested fraction inside a matrix cell) and a regression test that a stored solution containing a bmatrix round-trips to one token that renders as a matrix.
