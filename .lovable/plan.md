# Force the working note solution onto every line

The direct channel added for line 1 (`writeNoteForLine`) is already called for all lines — but your screenshot shows what's different about line 3: the row above it holds a TALL structure (the big fraction with the square root) that was typed live at the sensor. On that path the writer's "skip past the tall structure" logic can push the note several rows down, and if the collision/occupancy check misses the live-typed row, the note can land overlapped or off-view — reading as "nothing displayed, sensor jumped 4 rows".

## Changes

1. **Reproduce line 3 exactly as you hit it.** Playwright: write lines 1–2 onto the board through the Present chips / floating numbers (so the tall fraction rows exist, same as your session), then click the Line 3 note. Confirm the failure before touching code.

2. **Harden `writeNoteForLine` so it can NEVER fail silently — for every line 1 → last:**
   - After the write, VERIFY the note's ink actually exists on the board (signature check). If verification fails, force a second write at the first genuinely empty row below the deepest inked row — plain text fallback if needed. A note click must always end with visible ink.
   - Make the anchor/occupancy scan include the live typing row and the current sensor row's ink (not just committed rows), so a note can never be placed on top of — or hidden behind — a tall fraction that was just typed.
   - Scroll to the NOTE's own row after writing (not just the sensor row), so the note is always on screen when it lands.

3. **Cap the tall-structure skip.** When clearing a tall fraction's footprint, land on the first free row directly below it — never accumulate multiple extra skips that drop the note 4+ rows down.

## Files touched
- `src/components/smartboard/PresentationView.tsx` — `writeNoteForLine` verification + forced fallback write, live-row-aware occupancy, note-row scroll, capped tall-structure skip in `writeProseLineOnBoard`.

## Verification
- Playwright end-to-end on your notebook: reproduce your exact line-3 state (tall fraction on the board), click the note on EVERY line that has one (lines 1, 2, 3, 6 …) in Present mode, and screenshot-assert each note is visibly inked directly under its line with the sensor right below it.
- Repeat one note click twice — must scroll/show, never a bare sensor jump.
- Typecheck + full test suite.

No backend changes.