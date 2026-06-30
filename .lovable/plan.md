## Problem
When Lesson Notes drops a new line onto the board (`writeProseLineOnBoard`), it places it at `maxLine + 1`. For a row that holds a stacked fraction or tall radical, the structure extends 1+ physical rows below its baseline, so the next prose line lands inside the denominator. Result: "Substitute a, b, and c into the formula:" overlaps `2a` in the screenshot.

The structure-aware advance already exists for keyboard `Enter` (via `extraRowsFor`) but is bypassed by the mirror pipeline that paints AI/lesson-note rows onto the board.

## Fix
Make every code path that appends a new row reuse the same structure-aware offset.

1. In `src/components/smartboard/PresentationView.tsx`, inside `writeProseLineOnBoard`:
   - After computing `maxLine`, compute `extra = extraRowsFor(maxLine)` and also recursively walk upward: if `maxLine - k` rows are notebook-prose with their own measured heights, account for them too (single step is sufficient since each prose row is one logical line, but the equation row above may be tall).
   - Set `target = Math.max(maxLine + 1 + extra, sensor.line)`.
   - Update the sensor jump to `target + 1` (unchanged) so the cursor sits right under the freshly written prose.

2. Because `lineHeightsRef` is populated by `FreeWriteLayer`'s `ResizeObserver` asynchronously, the very first time a fraction line is appended `extraRowsFor` may still return 0. Add a one-shot reflow:
   - After a row is rendered and `handleLineMeasure` updates `lineHeightsRef`, detect when a later notebook-prose row is now overlapping (its `target` ≤ measured bottom of an earlier row) and shift it down by the deficit.
   - Implemented as a small effect keyed on `heightsTick` that scans `freeLines` in ascending order, recomputes each row's required clearance from the measured height of the row above, and rewrites `freeLines` / `notebookRowLines` keys when a shift is needed. Idempotent: only runs when a deficit is found.

3. Apply the same `extraRowsFor`-aware spacing to `ArrowDown` auto-floor placement (already partially covered by the manual-slack cap), and to any other path that calls `setSensor({ line: target + 1 })` after writing a math row — audit `writeProseLineOnBoard`, `writeEquationLineOnBoard` (if present), and the lesson-note mirror entry points.

4. No schema, no backend changes. Pure presentation logic in `PresentationView.tsx` (and reading the existing `lineHeightsRef`).

## Verification
- Reload the quadratic-formula lesson; "Substitute a, b, and c into the formula:" must render entirely below the `(…)/(2a)` denominator, not overlapping `2a`.
- Increase Row Spacing slider; the gap grows but no new overlap appears.
- Increase Text Size; the fraction grows taller, the prose below shifts further down accordingly.
- Press Enter on a line that holds a fraction (existing path) — behavior unchanged.

## Out of scope
- Floating Number panel bounds (already handled in the previous turn with 3-row clearance).
- Changing how `extraRowsFor` measures height — it remains DOM-measured via `ResizeObserver`.