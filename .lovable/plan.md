# Smartboard: 4 targeted fixes

## 1. Restore the row-gap after a tall structure

**Symptom (screenshot):** "Divide both terms in the numerator by 2" is rendering directly against the top of the fraction/radical row above it — the guaranteed empty row below a tall structure has disappeared.

**Root cause:** `sensorGapRowsBelow` (in `src/components/smartboard/PresentationView.tsx`, ~line 918) is still defined, but the prose-write path in `writeProseLineOnBoard` (~line 1086) and the ink-driven `nextSensorRowBelow` computations now target `lastVisibleInkRow + 1` from `freeLines` directly and no longer add `sensorGapRowsBelow(sourceRow)`. So when the last ink row is the bottom of a fraction/sqrt, the note lands on the next physical row instead of skipping one.

**Fix:**
- In `writeProseLineOnBoard`, when computing the target row for a note, add `sensorGapRowsBelow(prevRow)` on top of `nextSensorRowBelow` so a tall structure always reserves one blank row before prose.
- In the Enter/advance path (~line 2135) do the same: `t = nextSensorRowBelow(lastInk) + sensorGapRowsBelow(lastInk)`.
- Make `rowHasTallStructure` in `src/lib/smartboard/mathTree.ts` also return true for a row whose measured DOM height (via the ResizeObserver `rowHeightsRef`) exceeds one grid unit — this catches the connected radical whose new SVG-driven height grows without adding a `sqrt` node at the row root (e.g. when the sqrt is inside a fraction numerator).
- Add a regression test in `src/test/sensorSpacing.test.ts` asserting a fraction row followed by prose leaves one empty row between them.

## 2. D-pad ▼ must only move the sensor, never write

**Symptom:** Pressing ▼ on the D-pad "feeds the board" with solution ink.

**Root cause:** `nudgeCursor(1)` (~line 1646) calls `growActiveBand()` when the sensor exits the band bottom. `growActiveBand` extends `bandLines`, which triggers the line-sync effect (~line 2050) whose auto-advance branch (~line 2135) calls `writeProseLineOnBoard`/writes the next presentation line onto the freshly-added row.

**Fix:**
- Add a `manualDpadRef` flag set to `true` inside `nudgeCursor` for one tick and consumed in the line-sync effect: while the flag is on, the effect must NOT auto-advance the presentation line — it may only reposition the sensor.
- In `growActiveBand`, take a `{ silent: true }` option; when silent, skip any presentation write side-effects (only extend the band metrics).
- Ensure `activeSensorLogicalIdxRef` is not advanced during a manual nudge (it currently stays intact, but confirm no downstream effect reads `bandLines` growth as "line completed").

Net effect: ▼ scrolls the sensor into empty space; the teacher writes ink themselves.

## 3. Notebook glow gating

**Required behaviour:**
- On entering a section, if a notebook exists on the current line, clicking it renders immediately.
- If the teacher tries to advance to the next line without clicking, the notebook icon **glows** and forward advance is **blocked** until clicked.
- If ink from that line is erased and the sensor rewinds back, the icon must re-glow on the next forward attempt — even if it was previously clicked.

**Root cause:** The `notePlaced` set in `PresentationView.tsx` (~line 1835) marks a note as placed once clicked and never clears it on rewind. The line-sync/advance path checks only `notePlaced` and skips the glow gate.

**Fix:**
- Track note state per lesson line as `"idle" | "glow" | "placed"` in a new `noteStates` map keyed by `logicalLineIdx`.
- On forward advance attempt: if the current line has a note whose state is `"idle"`, set it to `"glow"` and block advance. If `"placed"`, allow advance.
- On erase-triggered rewind (existing Law-1 detector): reset the target line's note state back to `"idle"` so the next forward attempt re-glows.
- Clicking the note icon transitions `"idle"`/`"glow"` → `"placed"` and writes it to the board via `writeProseLineOnBoard`.
- Pass `state` down into `MathTreeRender`'s note-anchor renderer so it applies the pulsing glow class only when `state === "glow"`.

## 4. Floating Number line memory

**Required:** If the teacher is on line 6 of the floating panel and navigates away, returning to the page must resume at line 6.

**Fix:**
- In `FloatingNumberPanel.tsx`, persist the current line index to `localStorage` under `mathgpl.floating.line.<notebookId>.<sectionId>` whenever it changes.
- On mount, hydrate the initial index from that key (clamped to `[0, lines.length-1]`); fall back to 0 if absent or out of range.
- Clear the key when the section's floating content is regenerated (compare against a stored `linesFingerprint` so a stale index for a different content set is discarded).

## Verification
- `bunx vitest run` — all existing suites plus the new `sensorSpacing` case.
- Manual: type a fraction, press Enter → prose lands with a blank row between; press D-pad ▼ several times → sensor drops, no ink appears; click note vs. skip → glow behaviour matches; reload page → floating panel resumes at the same line.

## Files touched
- `src/components/smartboard/PresentationView.tsx` (spacing, D-pad, glow)
- `src/lib/smartboard/mathTree.ts` (`rowHasTallStructure` height check)
- `src/components/smartboard/MathTreeRender.tsx` (glow class from state)
- `src/components/smartboard/FloatingNumberPanel.tsx` (localStorage memory)
- `src/test/sensorSpacing.test.ts` (regression)
