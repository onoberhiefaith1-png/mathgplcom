# Lesson-Line Driven Smartboard (Final Redesign)

Replace the row-centric model in `PresentationView.tsx` with a **Lesson-Line model**. Rows become pure writing positions; Lesson Lines are defined by the Floating Number presentation and the teacher's ink, not by the grid.

## Core model change

Introduce `lessonLineOwners: Record<number, number>` — maps every physical row that has ink or a note to the **guided line index** that was active on the Floating Number panel when that row was written. This replaces `rowOwners` and the "sequential ordinal" seeding.

Rules:
- A Lesson Line = the set of rows whose owner === its guided index. It may be 1 row or 10 rows; the system never splits it.
- Only two events write to `lessonLineOwners`:
  1. Teacher types on a row while the panel shows guided line K → row belongs to K.
  2. A note is inserted → its rows belong to the currently displayed K.
- The board is never scanned to guess ownership. No content-matching, no "continuation" heuristic, no `stripEqLabel` fallback.

## Sensor rules

1. **Initial position**: when Floating Number mode opens (bandLines > 0), sensor = row immediately below the "Solution" caption, column 0. No `firstEmptyBandRow` offset, no reflow padding. Delete the "auto floor" logic.
2. **Teacher owns layout**: `nudgeCursor` / `nudgeCursorHoriz` / board tap may land on **any empty row** in the working area, at any column ≥ master left margin. No skipping tall structures, no auto-advance when ink matches.
3. **Advance on panel Next**: when the display moves K → K+1, find `maxRow = max(row where owner === K)`, then sensor = maxRow + 1, x = 0. If K has no ink yet, leave the sensor where it is.
4. **Rewind on panel Prev**: sensor parks at the end of the last row owned by the target line (or stays put if that line has no ink).
5. No automatic reflow when a structure grows. Delete the `extraRowsFor` / structure-clearance push in `writeProseLineOnBoard` and the reflow effect that shifts subsequent ink.

## Locking rules

- A row is **editable** iff `owner === displayedLineIdx` OR it has no owner (empty).
- A row is **locked** iff it has an owner ≠ displayedLineIdx.
- Enforced in three gates only: board tap, `FreeWriteLayer.onCursorChange`, and D-pad `nudgeCursor*`.
- No other path locks or unlocks. Remove the ink-match effect that currently locks lines based on Unicode parity.

## Notes (Book icon)

1. **Insertion point** = current sensor row + column. Modify `writeProseLineOnBoard` to write the note ink at `sensor.line` / `sensor.x` (not at a computed "next empty row"). All rows the note occupies get `owner = displayedLineIdx`.
2. **Glow logic** — a note is "complete" iff the ink on its owned rows exactly equals the note's original character sequence. On every render of the active line, compare `serialize(freeLines rows owned by K & tagged as note)` with the stored `note.canonical`. If not equal (missing, edited, partially deleted) → glow. Track this in a new `noteStatus: Record<lineIdx, "pending" | "complete">` derived state; the Book icon reads it.
3. After the teacher advances past the note's line, the glow state is frozen with the line's lock — glow only re-evaluates when the display returns to that line.

## Files to change (all frontend)

- `src/components/smartboard/PresentationView.tsx`
  - Replace `rowOwners` seeding effect with a pure "record on write" effect that watches `freeLines` deltas and assigns the current `displayedLineIdx` to newly-inked rows.
  - Rewrite sensor init: on `bandLines` transitioning to > 0, set sensor to `bandStart(activeLayout)` row, x = 0.
  - Rewrite `nudgeCursor` / `nudgeCursorHoriz`: remove `isEmptyWritableRow` structural filters and `firstEmptyBandRow` floor; allow any row in `[bandStart, bandEnd]` that is either empty or owned by displayed line.
  - Rewrite `stepTo` (panel Next/Prev): use `lessonLineOwners` to compute maxRow of previous line and park sensor there +1.
  - Delete the reflow effect and `extraRowsFor` padding.
  - Rewrite `writeProseLineOnBoard` to insert at sensor position and tag rows with `owner + kind: "note"`.
- `src/lib/smartboard/lessonLines.ts`
  - Add `noteStatus` helpers: `canonicalizeNote(text)` and `noteMatches(inkRows, canonical)`.
- `src/components/smartboard/BottomPanel.tsx` (or wherever the Book icon lives — confirm during build)
  - Read `noteStatus[displayedLineIdx]` for the glow class.
- `src/test/floatingSmartboardSync.test.ts`
  - Update expectations: sensor starts immediately below "Solution", multi-row Lesson Line 1 keeps ownership across all its rows, panel Next moves sensor to `maxRow + 1`, panel Prev unlocks all owned rows.

## What we delete

- `firstEmptyBandRow`, `rowCoveredByStructure`, `findNextWritableEmptyRow`, `extraRowsFor`, the `manualPushedRef` auto-floor logic, the ink-match auto-lock effect, and the sequential-ordinal seeding pass. These enforced a row-centric worldview that this redesign rejects.

## Verification

Playwright on `/smartboard/…`:
1. Open Floating Number panel → sensor renders directly below "Solution" (screenshot).
2. Type a multi-row equation (fraction) for Line 1 → all rows stay unlocked, no auto-advance.
3. Panel Next → sensor drops to `maxRow + 1`, all Line-1 rows become click-locked.
4. Panel Prev → Line 1 rows become editable again, sensor at end of last owned row.
5. Book icon: insert note at sensor → glow stops; delete one char → glow returns on that line only.
