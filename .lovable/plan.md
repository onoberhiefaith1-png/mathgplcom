# Fix: Line Never Goes Back + Previous Lines Can Never Be Overwritten

## What you're seeing

**Bug 1 — Line 7 snaps back to line 6 on every keystroke.** The previous fix moved the "erase detection" to row ownership, but it still reads only whole-row ink (`freeLines[r]`). Multi-row structures (fractions) store part of their ink under half-row keys (`r + 0.5`), and some rows a line owns can legitimately be blank. When line 6 contains such a structure, the check reads incomplete text, concludes line 6 was "erased", and rewinds — every time you type on line 7.

**Bug 2 — Line 5 disappears when you click the next equation.** After a two-row line (numerator/denominator), the sensor advance lands on the denominator row instead of below the whole structure. If you then click the next equation without manually moving the sensor, the write happens *at the sensor row* and replaces line 5's ink wholesale.

## The Law (permanent guards, not spot fixes)

Two invariants will be enforced in code so this class of bug cannot return for ANY row:

**Law 1 — Forward-Only Rule:** The presentation may only rewind when ink was *actually deleted* from the latest completed line's own rows. Typing anywhere else on the board can never trigger a rewind.

**Law 2 — Locked-Ink Rule:** A row owned by a completed lesson line is immutable. No write path (typing, chip click, note placement, equation insertion) may replace or clear it. If a write targets a locked row, it is automatically relocated to the first empty row below the last ink — the old ink always survives.

## Implementation

### 1. Rewrite the erase/rewind effect (`PresentationView.tsx`)
- Keep a snapshot of the previous `freeLines`. Rewind is only considered when the total ink on the candidate line's owned rows **decreased** since the last render (real deletion). New ink appearing on other rows never fires it — this is Law 1 and kills the line-7 regression by construction.
- When comparing line text, concatenate ascii from both integer and half-row keys (`r` and `r + 0.5`) of every owned row so fractions/multi-row structures read complete.
- Rows the line owns that are legitimately blank (structure spillover) no longer count against the match.

### 2. Sensor advance skips the whole structure
- When advancing from line N to N+1, the target row = one row below the **lowest row occupied by line N** (owned rows including half-keys, plus `extraRowsFor` tall-structure padding). The sensor can no longer park on a denominator row.

### 3. Locked-row write guard (Law 2)
- Add a single `isLockedRow(row)` helper: row is owned by a lesson line earlier than the currently displayed one.
- `writeProseLineOnBoard` and every insertion path (`editActive`, chip/equation placement) check it. If the target row is locked **and has ink**, the write relocates to the next empty row below the last visible ink instead of replacing — existing ink is never destroyed.

### 4. Regression tests (`src/test/sensorSpacing.test.ts`)
- Line with fraction across `r` and `r + 0.5` → erase check reads full text, no false rewind.
- Typing on a fresh row N+1 while lines 0..N match → rewind never fires (Forward-Only Rule).
- Ink actually deleted from latest line → rewind still fires (behaviour preserved).
- Write targeting a locked inked row → relocated below, original ink intact.
- Sensor advance after a two-row fraction line → lands below the denominator, not on it.

## Files to touch
- `src/components/smartboard/PresentationView.tsx` — erase effect, sensor advance target, locked-row guard.
- `src/test/sensorSpacing.test.ts` — new regression suite.

## Verification
- Full vitest suite passes.
- Manual: solve through 7+ lines including a fraction line — no snap-back at any line; clicking the next equation while the sensor sits on a fraction's lower row relocates the write instead of erasing the fraction.
