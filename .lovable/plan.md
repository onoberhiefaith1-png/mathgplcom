# Fix line-check assessment + bracket rendering

Two independent fixes on the student assessment board.

## 1. Line check should assess by line tag, not board position

### Problem
Today, when a student taps **Check**, the code grabs the *k-th written physical row* in the band (`writtenRows[activeLineIdx]`) and grades that. This breaks when the student writes the line anywhere on the board, or when rows aren't in strict top-to-bottom order — the checker "can't find" the line.

### How it should work
Every floating number already belongs to a specific line (the reservoir stores each line's chips as `fragments[fragmentStart..fragmentEnd]`). When checking line N:

1. Build the **expected chip multiset** for line N from its own fragments (its tag), e.g. line 2 = `{5x, +4y, =, 13}` — distinct from the same-looking chips on other lines.
2. Scan every written row in the active band and compute each row's chip multiset (via `rowToAscii` + `extractTermsFromAscii`).
3. **Locate** the one row whose chips match line N's expected set (exact multiset match preferred; otherwise the row with the highest overlap of line-N chips). That row is the student's line N — wherever it physically sits.
4. If line N's chips are **scattered** across multiple rows (no single row contains a complete equation made of them), reject with a clear message ("Arrange all of line N's terms on one line") instead of silently grading the wrong row.
5. Send that located row's arrangement to the existing `grade-assessment` function exactly as today (server still holds the hidden key and decides correctness/structure).

This means: the student can start at the top-left, drop down to the bottom, write line 2 there — the checker finds it by tag and marks it. Scattered terms (ax² on one row, bx on the next, c below) are detected and refused because they don't form one line.

### Where
- `src/components/smartboard/PresentationView.tsx` → `checkActiveLine` (around lines 1286-1345). Replace the positional `writtenRows[activeLineIdx]` selection with the tag-based locate-and-match logic above. The expected chip set comes from `activeReservoir.fragments` sliced by `target.fragmentStart/fragmentEnd`, normalised the same way the grader normalises chips. Keep the existing "complete equation / has =" guard and the `grade-assessment` call unchanged.
- No server/answer-key change — grading stays server-authoritative.

## 2. Bracket structure renders raised like an exponent

### Problem
Insert a bracket from the structure menu, type inside it, and the content floats up as if it were a superscript. Cause: in `BracketView` the wrapper uses `alignItems: "center"` together with `verticalAlign: "baseline"`. A centered inline-flex box has no real baseline, so the browser synthesises one at its bottom edge and the whole bracket gets pushed above the text baseline. (Fractions don't have this bug because they use `verticalAlign: "middle"`.)

### Fix
- `src/components/smartboard/MathTreeRender.tsx` → `BracketView`: change `verticalAlign: "baseline"` to `verticalAlign: "middle"` (matching the working `frac`/`matrix`/`binom` views) so a bracket and its contents sit at the same height as the surrounding numbers. This also fixes `abs`, `norm`, `floor`, `ceil` (all built as bracket nodes).
- Audit the other container views for the same height behaviour: `frac`, `matrix`, `binom` already use `middle` (correct); `power`/`sup`/`sub` are intentionally raised/lowered (correct). Adjust `sqrt` only if it shows the same raised-content symptom after the bracket fix.

## Verification
- Reload the student assessment board.
- Insert a bracket, type a value: content sits inline at number height (not raised).
- Write line 2's terms anywhere on the board and tap Check: it is found by tag and graded; scattering the terms across rows is rejected with a clear message.
