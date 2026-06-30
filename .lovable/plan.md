## Goal

The writing sensor must always sit on the **first empty row** of the active Solution band — never on a row that already contains an equation, note, or floating-number ink. The Cursor Scrollbar can push the sensor further down into empty space, but never back up onto written content.

## Current behavior (problem)

When the teacher presses `#`, `PresentationView` anchors the sensor at `bandStart(activeLayout)` — the row directly under the “Solution” caption — regardless of whether equations are already written there. The Cursor Scrollbar then lets the teacher move freely up/down across both empty and written rows.

## New rules

1. **First-empty anchor.** On entering solving mode (or whenever the active beat / written content changes while solving), the sensor snaps to the lowest row `r` in `[bandStart, bandEnd]` such that:
   - `r` is writable (`isLineWritable(r)` — not a notebook-prose row, not a caption), and
   - no row `≤ r` in the same band carries content (i.e. `freeLines[k]` is empty/absent for every written-content key `k ≤ r`), accounting for tall structures via the existing `extraRowsFor(line)` measurement so the sensor lands below the full visual height of fractions / √ on the previous row.
2. **Auto-advance after writes.** When the row under the sensor becomes non-empty (Enter, or content lands via floating-number tap), the sensor re-runs rule 1 — it never stays on a written row.
3. **Scrollbar = empty space only.**
   - `canCursorUp` is true only while `sensor.line > firstEmptyRow`. Pressing ↑ on the first empty row is a no-op (button disabled).
   - `canCursorDown` stays true as long as there are empty rows ahead inside the band; when the teacher reaches the bottom, ↓ grows the band by one row (existing `growActiveBand`) and steps onto it.
   - Both directions still skip locked notebook-prose rows.
4. **Master-left margin** preserved: every nudge resets `x: 0` and clears the live tree cursor (already done).

## Files to change

- `src/components/smartboard/PresentationView.tsx`
  - Add helper `firstEmptyBandRow(L: BeatLayout): number` that walks `bandStart(L) … bandEnd(L)`, accounts for `extraRowsFor` of any written row above, and returns the first writable empty row (or `bandEnd+1` triggering `growActiveBand`).
  - Replace the “snap to `bandStart`” logic in the solving-mode entry effect (lines 1408–1418) with a snap to `firstEmptyBandRow(activeLayout)`.
  - Add a second effect that watches `freeLines` + `activeLayout?.id` while `solvingMode` is true: if `sensor.line` is no longer the first-empty row AND the teacher hasn’t manually pushed the sensor below it via the scrollbar, re-snap. Manual override is tracked with a `manualPushedRef` set inside `nudgeCursor(+1)` past the auto floor and cleared when the auto floor advances past it.
  - Update `canCursorUp` to require `sensor.line > firstEmptyRow` (the auto anchor), and `nudgeCursor(-1)` to clamp at that anchor.
  - Update `nudgeCursor(+1)` so that hitting `bandEnd` calls `growActiveBand()` and steps into the new row.
- `src/test/floatingSmartboardSync.test.ts` — extend with three cases:
  1. Empty band → sensor at `bandStart`.
  2. Two written rows at top → sensor at `bandStart + 2` (and below tall √ structure when measured height > 1).
  3. Scrollbar ↑ from the auto anchor is blocked; ↓ moves into empty rows and eventually grows the band.

## Technical notes

- “Written” means: `freeLines[k]` exists and has at least one non-empty atom, **or** the row is occupied by a structure whose visual height (from `extraRowsFor`) extends into it from a row above.
- Notebook-prose rows (`notebookRowLines`) are treated as written for the “skip past” calculation but never become a sensor target.
- The Floating Number panel’s own visibility gate (`activeAssistant === "numbers"`) is unchanged; only sensor placement is affected.
- No backend/schema change. No new storage keys.
