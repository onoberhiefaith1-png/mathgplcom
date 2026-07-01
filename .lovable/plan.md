## Sensor D-pad: chromeless, persistent, auto-hide, and actually movable

### 1. Remove the D-pad background
In `src/components/smartboard/SensorDPad.tsx`, drop the outer rounded container's `background`, `border`, `boxShadow`, `backdropFilter`, and padding. Only the five circular arrow buttons remain, floating directly on the board. Keep the buttons themselves as small translucent circles so they still read as controls, but the surrounding "card" disappears and blends into the screen.

### 2. Always visible (no gating on the # panel)
In `PresentationView.tsx`, change the mount condition from `canEdit && solvingMode && panelOpen` to just `canEdit && solvingMode`. The D-pad appears the moment the Solution workspace exists — the teacher no longer has to open the bottom Floating Number panel first. Its `bottomPx` still shifts up/down based on whether the panel is open, so it never overlaps the panel.

### 3. 50-second idle auto-hide with activity revival
Inside `SensorDPad.tsx`:
- Add local `visible` state, default `true`.
- Start a 50 s timer on mount; on expiry set `visible=false` (CSS: opacity 0, `pointer-events:none`, 250 ms fade).
- Reset the timer on: any button press on the D-pad, any `pointermove` / `pointerdown` / `wheel` / `touchmove` inside a "hot zone" around the D-pad (a ~220 px × 220 px invisible rect centered on the pad, attached to `window`). Activity anywhere else on the board is ignored so it doesn't fight normal writing.
- When hidden and activity fires inside the hot zone, set `visible=true` and restart the 50 s timer.

### 4. Fix the stuck sensor (down / right / left do nothing)
The D-pad callbacks currently call `setSensor(...)`, but `PresentationView` runs an auto-anchor effect that re-pins the sensor to `firstEmptyBandRow` on every layout tick, immediately undoing any manual nudge. `manualPushedRef` only covers the downward-grow case, not left/right or upward-within-band moves.

Fix in `PresentationView.tsx`:
- Promote `manualPushedRef` to a richer `manualSensorRef` that stores `{ line, x, at }` whenever the D-pad fires.
- In the auto-anchor effect, if `manualSensorRef.current` is set AND its `{line,x}` still lies inside a writable empty region (uses existing `isEmptyWritableRow` + horizontal-in-bounds check), skip the auto reset — respect the manual position.
- Clear `manualSensorRef` when: beat changes, active reservoir changes, or new ink lands on the manually chosen row (auto-anchor then resumes).
- For `nudgeCursorHoriz`, also drop the `isEmptyWritableRow` guard when the target row is the current sensor row and already empty; log a `console.debug` on early-returns during development so future regressions surface fast.

### 5. Verification
After the edits, drive Playwright against `/smartboard/...`: press ▼ three times, then ▶ five times, screenshot, and assert the sensor caret has moved down-and-right rather than snapped back to Solution+1.

### Technical notes
- Files touched: `src/components/smartboard/SensorDPad.tsx`, `src/components/smartboard/PresentationView.tsx`.
- No changes to `grid.ts`, no changes to the Floating Number panel, no backend work.
- `TAB_HEIGHT` / `PANEL_HEIGHT` continue to drive `bottomPx` so the pad clears the bottom drawer.
- The 50 s timeout is a named constant `SENSOR_IDLE_MS = 50_000` for easy tuning.
