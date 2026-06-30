## Goal

Make the writing sensor a **modal tool tied to the Floating Number (#) button**, not a permanent fixture. Bind it strictly to the current Solution working area, drive it automatically during solving, and let the new Cursor Scrollbar provide *manual extra space only*.

---

## 1. Sensor activation gate

Edit `src/components/smartboard/PresentationView.tsx`.

- Introduce a single source of truth `solvingMode` (boolean) derived from the existing `#` floating-number toggle state.
  - `solvingMode = true` only when the `#` button is ON **and** the current beat has a Solution (writable working area).
  - On `#` OFF, on beat change, or on navigation away from a solvable beat → `solvingMode = false`.
- Render `WritingSensor`, the Cursor Scrollbar, and the Floating Number panel **only when `solvingMode === true`**.
  - When false: no caret pulse, scrollbar buttons disabled/hidden, panel closed.
- Hard-disable key handlers (`Enter`, character input, arrow caret movement) when `solvingMode === false` so reading the lesson cannot accidentally write.

## 2. Initial sensor placement under "Solution"

- When `solvingMode` flips from false → true:
  - Resolve the active beat's `WorkingArea` via `lessonLines.ts → workingAreaFor`.
  - Set `beatCursor` / `liveCursor` to `{ row: workingArea.topRow, x: masterLeftMargin }` — i.e. the first writable Lesson Line, which already sits directly below the auto-generated "Solution" caption (we reserved `+3` caption rows in the earlier fix).
  - Clear `autoFloorRef` to this row so the 3-row slack window restarts here.
- Never restore a stale `localStorage` cursor that lies above the Solution heading; clamp to `workingArea.topRow` on hydrate.

## 3. Automatic sensor advance after each completed equation

Already partially implemented (`extraRowsFor`, reflow engine). Tighten:

- After Enter / structure commit, compute the bottom row of the just-written Lesson Line via the measured-height path (`ResizeObserver` heights from `FreeWriteLayer`).
- Move the sensor to `bottomRow + 1` (one default editable row of gap), snap `x` to the master left margin, and update `autoFloorRef` to this new row.
- Skip any locked rows in between (notebook prose, captions) using `nextWritable`.

## 4. Cursor Scrollbar — *manual space only*

Edit `src/components/smartboard/CursorScrollbar.tsx` + `PresentationView.tsx`:

- Scrollbar is mounted only while `solvingMode === true`.
- ▼ moves the sensor down one physical row inside the **current** working area; ▲ moves it up one physical row but never above `autoFloorRef` (cannot rewind into completed work).
- Hard clamps:
  - Cannot cross `workingArea.topRow` upward.
  - Cannot cross `workingArea.bottomRow` downward — instead extends the band by 1 row (existing `growActiveBand`) up to the next beat's first row minus 1.
  - Cannot enter any `kind !== "writable"` line (already enforced in `nudgeCursor`; verify).
  - Existing ±3 row slack from `autoFloorRef` remains.
- Buttons disable (greyed) when their direction is blocked.

## 5. Section / beat boundaries

- On beat navigation (Prev/Next Section, beat click), force `solvingMode = false`, hide sensor + scrollbar, close `#` panel.
- The teacher must re-press `#` on the new beat to start solving there; the sensor then re-anchors under that beat's "Solution" caption per step 2.

## 6. Cleanups

- Remove any code path that mounts `WritingSensor` based on route load alone.
- Remove `localStorage` restore of cursor outside an active working area.
- Keep the Floating Number panel's ▲/▼ chip rotation (already decoupled from cursor in the previous turn).

## Files touched

- `src/components/smartboard/PresentationView.tsx` (activation gate, initial placement, auto-advance tightening, scrollbar clamps, beat-change reset)
- `src/components/smartboard/CursorScrollbar.tsx` (disabled state visuals; minor)
- `src/components/smartboard/FloatingNumberPanel.tsx` (mount only in `solvingMode`)
- `src/components/smartboard/WritingSensor.tsx` (no logic change; conditional mount upstream)
- `src/test/floatingSmartboardSync.test.ts` (extend: # toggle gates sensor; initial row = workingArea.topRow; ▲ blocked above autoFloor; ▼ extends band; beat change clears sensor)

## Out of scope

- No change to lesson-note editor, floating-number generator, AI prompts, or DB.
- No change to top bar, eraser, bottom panel layout, or chip rendering.
