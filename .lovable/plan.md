# Fix: D-pad Doesn't Move the Sensor + Free Movement in Empty Solution Space

## What's going wrong

The D-pad presses ARE firing, but an auto-anchor effect immediately snaps the sensor back — so it looks frozen:

1. When you press ▲/▼, `nudgeCursor` sets the new position **but also resets the internal "logical line" tracker to null**. The line-sync effect then thinks the presentation line changed, **wipes the manual position (`manualSensorRef`)**, and re-anchors the sensor to its computed spot. Net result: the sensor never visibly moves.
2. ▲ is additionally hard-clamped at the "first empty row" floor — so even without the snap-back, upward movement inside the empty solution space is forbidden.
3. ◀/▶ moves survive slightly longer but get reverted by the same re-anchor whenever any dependency of that effect changes.

## The fix

### 1. Stop the auto-anchor from fighting the D-pad
- Introduce an explicit **manual-override mode**: while `manualSensorRef` is set, the line-sync/auto-anchor effect leaves the sensor completely alone.
- The override is cleared ONLY when:
  - The teacher navigates the Floating Number display to a different line (explicit panel ▲/▼), or
  - Ink lands on the manually chosen row (writing resumes normal auto-flow), or
  - The beat/section changes.
- `nudgeCursor` / `nudgeCursorHoriz` will no longer null the logical-line tracker (that was the trigger for the snap-back).

### 2. Free 4-way movement inside the empty solution region
- **▲ Up**: allowed onto ANY empty, writable row inside the active Solution band — remove the "auto floor" clamp. Skips over written/locked rows, notes, and structure-covered rows.
- **▼ Down**: as today — moves to next empty row, grows the band at the bottom edge.
- **◀ ▶**: free horizontal movement within the current empty row, clamped at master left margin and board right edge.
- Boundaries always respected: sensor never lands on the Solution heading, question rows, notebook notes, or inside math structures.

### 3. Line locking (write → lock → unlock via display)
- Once a row contains a completed lesson line and the teacher advances past it, that row is **locked**: the D-pad skips it and clicks on it are ignored.
- To edit a locked line, the teacher navigates the Floating Number display back to that line — that unlocks exactly that row and parks the sensor on it (this reuses the existing "presentation decides → cursor follows" pathway, so it comes mostly free).

## Technical details
- `src/components/smartboard/PresentationView.tsx`:
  - `nudgeCursor`: remove auto-floor clamp for ▲; search target with a version of `findNextWritableEmptyRow` that also treats locked/written rows as barriers to land on but transparent to jump over; keep `activeSensorLogicalIdxRef` intact.
  - Line-sync effect (~line 1799): early-return unconditionally while `manualSensorRef.current` is set; clear it only on explicit floating-line change / ink-on-row / beat change.
  - `canCursorUp`: true whenever an empty writable row exists above the sensor inside the band.
  - Locked-row set: derived from rows whose guided line index < current `activeLineIdx`, minus the row currently selected via the Floating Number display.
- No backend changes.
