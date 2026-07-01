# Fix Floating Number Line Flow: Start at Line 1, No Auto-Advance, Panel-Driven Locking

## Problems observed

1. **Skips Line 1 on entry** — when the lesson loads, two mechanisms jump the presentation forward: a localStorage "lesson cursor" restore and a "resume to highest completed line" scan. Line 1 (a notebook/prose line with no equation number) is also auto-skipped by the notebookOnly fast-forward. The teacher lands on Line 2 without ever walking through Line 1.
2. **Sensor advances on its own** — the moment the board ink matches the target equation (e.g. `x + y = 7`), an auto-advance effect immediately bumps the floating line index and moves the sensor down. The teacher never gets to finish the line (e.g. append the `(1)` equation number) because the row is instantly locked.
3. **Displayed line is locked** — even while the Floating Number display is showing Line 2, the row is treated as "written = restricted", so the teacher cannot edit it.

## New behavior (the rule)

- **The Floating Number display is the single source of truth.** The line it currently shows is ALWAYS editable. Nothing advances or locks automatically.
- The sensor moves down and a line locks **only** when the teacher navigates the Floating Number display forward to the next line.
- Navigating the display **back** to a previous line unlocks that line for editing again.
- The presentation **always starts at Line 1**, even if earlier lines already have ink on the board.

## Changes (all in `src/components/smartboard/PresentationView.tsx`)

### 1. Always start at Line 1
- Remove the localStorage restore that sets `activeLineIdx`/`floatingLineIdx` from the persisted lesson cursor on mount.
- Remove (or neutralize) the "resume to highest completed lesson line" effect that scans the board and jumps forward — it will still mark already-written lines' chips as consumed (green), but will not move the displayed line or the sensor.
- Remove the notebookOnly fast-forward so Line 1 (prose-only) is displayed first and the teacher steps past it manually.

### 2. Kill silent auto-advance
- In the strict-sequential match effect: when the board line matches the target equation, keep marking fragments/structures as consumed (chips turn green) but **stop** calling `setActiveLineIdx`/`setFloatingLineIdx` and **stop** moving the sensor. The line stays open so the teacher can still add `(1)` etc.
- Make the equation comparison tolerant of a leading/trailing equation label like `(1)` so the line still reads as complete whether or not the number has been added yet.

### 3. Advance only via the Floating Number display
- When the teacher taps Next on the panel (moves to line N+1): commit line N (mark consumed, lock its row), advance `activeLineIdx`/`floatingLineIdx` together, move the sensor to the first empty writable row below, and snap to the master left margin.
- When the teacher taps Prev (back to line N): unlock line N's row, park the sensor on it so it is editable again; moving forward re-locks it.

### 4. Lock gate follows the displayed line
- Update the click/typing gate (`isLineWritable` + board tap gate) so the row that belongs to the currently displayed floating line is always writable — whether empty or already written — and all other written rows stay restricted.
- The D-pad keeps working inside empty space as today; no changes to its free-roam behavior.

## Verification
- Playwright run against the Solution page: load lesson → panel shows Line 1 first; write `x + y = 7`, confirm sensor stays put and `(1)` can still be typed; tap Next → sensor drops one row and previous line locks; tap Prev → previous line editable again.
- Existing sync tests (`floatingSmartboardSync.test.ts`) re-run to catch regressions.