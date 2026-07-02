# Fix: Sensor must land exactly one row below the last equation

## The problem
When you finish a line and the system advances, the sensor lands ~3 rows below the equation instead of the very next row. Pressing ▲ once fixes it manually — proving the *correct* row is empty and writable, but the auto-advance picks the wrong target.

## Root cause (what I found in the code)
The "next row" is computed from the **row-ownership map** (`rowOwners`), not from the actual ink on the board:

- `target = maxPrevOwned + 1` — where `maxPrevOwned` is the highest row *registered as owned* by a previous line.
- The ownership map can contain stale or stray entries: any row that momentarily had content (placeholder nodes, half-row `+0.5` keys, leftover entries after erasing) stays registered, so `maxPrevOwned` can point 2–3 rows below the real equation.
- There are also **two separate advance paths** (the Enter-key handler and the line-sync effect) that compute the target differently, so they can disagree.

This matches your observation exactly: the *definition of "last row"* is wrong, not the +1 step.

## The fix

1. **One definition of "last inked row"** — a single helper `lastInkRowBelow()` that scans the actual board content (`freeLines`) inside the solution band and returns the lowest row that contains *visible* ink (real characters/structures — empty or whitespace-only rows are ignored). This becomes the sole source of truth, replacing `maxPrevOwned` from the ownership map.

2. **Sensor target = last inked row + 1** — plus extra rows only when that row genuinely contains a tall structure (fraction, matrix, ∑/∫), which is already handled by `rowHasTallStructure`. Plain equations → exactly one row below, zero gap.

3. **Unify all advance paths** — Enter key, line-completion advance, and the floating-number line-sync effect all call the same helper, so the sensor can never land differently depending on *how* you advanced.

4. **Clean the ownership map** — rows whose content is empty/whitespace release ownership immediately, so stale entries can't poison future calculations.

## Verification
- Regression tests: "finish plain equation → sensor is at lastInkRow + 1, never +2/+3"; "stray empty row entries are ignored"; "fraction row still reserves its extra row".
- Playwright run against the live board reproducing your exact flow (write `x + y = 7(1)`, advance) with a screenshot confirming the sensor sits directly under the equation.

## Technical details
- `src/components/smartboard/PresentationView.tsx` — new `lastInkRowBelow()` helper; rewrite target computation in the line-sync effect (~line 2007) and Enter handler (~line 3320) to use it; ownership cleanup in the `setRowOwners` incremental effect.
- `src/test/sensorSpacing.test.ts` — new regression cases.
