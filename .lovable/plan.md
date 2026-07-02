# Consistent Lock/Unlock Driven by the Floating Number Display

## The rule (as you stated it)
- While the Floating Number display shows Line N, **every row belonging to Line N is editable** — the sensor may enter it and move left/right inside it.
- Line N locks **only after** the display moves forward to Line N+1.
- Moving the display back to any line re-unlocks it.

## Why it still locks prematurely
The current unlock logic resolves the displayed line to exactly **one** physical row by counting occupied rows in order (1st equation → 1st occupied row, 2nd → 2nd, …). This breaks in two ways:

1. **Multi-row lines**: Line 3 on your board is a continuation (`= x − y`) that lives on its own physical row. When one lesson line spans two or more rows, the ordinal count shifts — the system unlocks the wrong row and treats the real Line 3 rows as "past content = locked".
2. **Single-row assumption**: even when the mapping lands on the right first row, the continuation rows of the same line are never included in the unlocked set.

## Changes (all in `src/components/smartboard/PresentationView.tsx`)

### 1. Replace `displayedLineRow` (single row) with `displayedLineRows` (a set of rows)
- Map each guided equation line to its **group of physical rows** instead of a single row:
  - Walk the occupied non-notebook rows in the active band in order.
  - Group consecutive rows into one lesson line when a row is a *continuation* — i.e. its ink starts with a relation symbol (`=`, `⇒`, `∴`) or the previous row has no complete `=`-relation yet, and it isn't matched as the start of the next guided line (checked with the existing Unicode-parity matcher + `stripEqLabel`).
  - The K-th group belongs to the K-th equation guided line.
- The result: displaying Line 3 unlocks **all** rows in group 3, including the `= x − y` continuation row.

### 2. Use the row set in both gates
- Board tap gate and `FreeWriteLayer.onCursorChange`: allow caret placement on any row in `displayedLineRows` (plus the sensor's current row and empty rows, as today). Everything outside stays locked.
- `isLineWritable` stays unchanged for band/notebook restrictions.

### 3. Sensor can roam left/right inside the displayed line
- `nudgeCursorHoriz` currently refuses to move on any row that has ink. Relax it: when the sensor is on a row belonging to `displayedLineRows`, ◀/▶ moves the **caret through the existing ink** (tree-cursor step) instead of shifting the row offset — so the teacher can walk into the middle of Line 3 and edit.
- ▲/▼ may also land on `displayedLineRows` rows (today they skip all written rows).

### 4. Locking happens only on display navigation
- Verify no remaining path locks a row while its line is displayed: the match-detection effect stays passive (chips only), and `stepTo` (panel Next/Prev) remains the sole place where the previous line's rows drop out of the unlocked set and the sensor advances.
- When the display rewinds to Line N, the sensor parks at the end of Line N's last row, ready to edit.

## Verification
- Playwright on your Solution page: write lines 1–3 including the wrapped `= x − y` row; keep the display on Line 3 → tap and D-pad into the continuation row and confirm the caret enters and edits it; move display to Line 4 → confirm both Line 3 rows lock; move back to Line 3 → confirm both unlock again.
- Re-run `floatingSmartboardSync.test.ts` for regressions.
