# Fix: sensor dead-zone after placing a note (line 6+)

## Root cause found — two pieces of code, both get deleted

1. **Capped sensor walk** (`directWrite.ts`): after a note lands, the sensor is parked by a walk that gives up after **4 steps**. Lines 1–5: fewer than 4 blocked rows below → sensor lands on a free row → fine. Line 6+: the board below is dense with locked note rows and ink → the cap expires → the sensor is parked **on a locked row**, 4–5 rows down.
2. **Silent click-swallow** (`editActive` in `PresentationView.tsx`): when the sensor sits on a locked row, every chip tap and keystroke is silently thrown away. No error, no movement — "nothing is clickable". That is the dead zone you escape by manually dragging the sensor.

So it isn't the Floating Number restricted area — it's a hard-coded 4-step limit plus a silent swallow. Deleting both makes line 6 identical to line 1.

## What will be rebuilt (delete, not patch)

### A. Sensor parking — one rule, no cap
- Delete the capped `sensorRow` walk in `planDirectWrite`.
- New tiny module `src/lib/smartboard/boardWriter/parkSensor.ts`: `parkRowBelow(snap, lastInkRow)` — walk down from the row below the ink using the **same** `rowIsBlocked` rule the ledger already uses for placement, with the same SCAN_CAP (200), so it can never expire early. First genuinely free, writable row wins — for line 1 and line ∞ alike.
- `commitWritePlan` computes the park row from the **post-commit** snapshot (ink + locks as they are after the note lands), so the sensor can never be parked on a row the write itself just locked.

### B. No more silent swallow — relocate instead
- Delete the "locked row → focus and return" swallow in `editActive`.
- New behavior: if the sensor is on a locked/notebook row when a write arrives, auto-relocate the sensor to the first writable row below (same `parkRowBelow` rule) and write there. A click **always** produces ink somewhere sensible — never nothing.
- Same fix applied to the sibling paths that share the swallow assumption: `presentWriteAtSensor` and the Floating Number chip tap path (both currently do their own bounded `while (t <= bandEnd)` hunts — replaced by the one shared rule).

### C. Consistency guarantee
- All four movers of the sensor after a write (note write, chip tap, present-mode write, D-pad-free auto-advance) end up on the SAME shared function. No per-path caps, no per-path hunts.

## Verification
- Unit tests: park row after a note when 0, 3, 6, 12 consecutive blocked rows follow — sensor always lands on the first free row, never on a locked one.
- Unit test: write arriving while sensor is on a locked row relocates and lands ink (never a no-op).
- Playwright on your lesson: place notes on lines 1→9 in sequence; after each note, assert the sensor row is not locked and a chip tap immediately lands ink. This reproduces your exact line-6 failure before the fix and proves it gone after.

## Files
- edit: `src/lib/smartboard/boardWriter/directWrite.ts` (remove capped walk from the plan)
- new: `src/lib/smartboard/boardWriter/parkSensor.ts`
- edit: `src/components/smartboard/PresentationView.tsx` (`commitWritePlan` post-commit park; `editActive` relocate-not-swallow; `presentWriteAtSensor` unified)
- tests: `src/test/parkSensor.test.ts`

Nothing else changes: notes still write every click (no dedupe), autoplay stays deleted, the two engines stay independent.