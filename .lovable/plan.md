## Smart Lesson Cursor — make the cursor follow the lesson, not the teacher

Scope: only the cursor/sensor logic inside the Smartboard Presentation. No changes to the Floating Number panel rendering, the writing surface, or the Lesson Note system.

### Core idea
Stop treating `sensor.line` as a free physical row the teacher steers. Instead, the **active lesson line** (`activeLessonLineIdx`) becomes the source of truth, and the sensor is a derived value the system writes to.

A "lesson line" = one entry in `activeReservoir.lines[]` (one mathematical step). It may span 1–N physical rows. Lesson lines are already known: they map 1-to-1 with the Floating Number panel's lesson-line slider.

### Behaviour changes

1. **Sensor follows Presentation, never the click**
   - The single source of truth is `activeLessonLineIdx` (derived from `manualFloatingLineIdx ?? floatingLineIdx`, clamped to `guidedLines.length - 1`).
   - The sensor's physical row is computed from that index — never set by `FreeWriteLayer.onCursorChange`. Clicks on the board are ignored for caret placement when a guided lesson is active.
   - The existing "K-th occupied row inside band" anchor stays, but is the only writer of `sensor.line` during guided mode.

2. **Lesson-line completion auto-advance**
   - After each keystroke, check whether the freeLines row(s) belonging to `activeLessonLineIdx` satisfy `equationsMatch / equationsEquivalent` against `guidedLines[idx].equation` (logic already exists for the Next-button gate — reuse it).
   - When matched, mark the line complete (`completedLessonLines: Set<number>`), advance `floatingLineIdx`, and re-anchor the sensor to the first writable physical row of the next lesson line. Empty physical rows between lines are skipped automatically.

3. **Hard lock on previous lesson lines**
   - `editActive(line)` returns true only when `line` belongs to the rows assigned to `activeLessonLineIdx`. All rows owned by lower indices are locked (typing/backspace/IME ignored).
   - The current "notebook prose lock" stays as-is and stacks with this lock.

4. **Unlocking via Presentation**
   - The only way to edit an earlier lesson line is to rewind through the FloatingNumberPanel (Prev arrow / line picker). Setting `manualFloatingLineIdx = k` re-activates line `k`, clears `completedLessonLines` entries `>= k` if the teacher then edits, and re-anchors the sensor.

5. **Resume to highest completed line**
   - On mount / when `activeReservoirIdx` changes, scan `freeLines` against `guidedLines` to compute the highest lesson line that already exists on the board. Initialise `floatingLineIdx = highestCompleted + 1` (clamped). Replaces the current `setFloatingLineIdx(0)` reset in the effect at lines 1302-1313.

6. **Intelligent deletion / no regeneration of old lines**
   - When the teacher erases ink, recompute `completedLessonLines` from the board, but do NOT auto-rewind `floatingLineIdx` unless the erased line is the current highest completed one. Specifically:
     - If erased line < highest completed-and-still-present → leave `floatingLineIdx` where it is (lesson has progressed past it).
     - If erased line == the line just above the active one (i.e. it was the most recent completion) → rewind `floatingLineIdx` to that line so the teacher can rewrite it.

7. **Notebook never re-requested**
   - Persist `shownNotebookIdx` per `(reservoirId, lessonLineIdx)` in `sessionStorage` keyed by notebook+subsection+reservoir id. On reservoir entry, hydrate the set so already-revealed notebooks are never re-prompted. Also seed the set from the board: if a row is tagged `notebookRowLines` for line K, mark K as shown.

### Files to change (all under `src/components/smartboard/`)
- `PresentationView.tsx`
  - Replace the click-driven cursor commits (`onCursorChange` in `FreeWriteLayer` around line 2158-2165, the `setCursor`/`setLiveCursor` calls in 2557-2626) with a guarded version that only accepts caret moves WITHIN the rows owned by the active lesson line.
  - Rework the effect at 1302-1313 to compute `initialLessonLineIdx` from the board.
  - Extend the anchor effect at 1326-1384 to also run on `activeLessonLineIdx` change and own all sensor writes.
  - Add `completedLessonLines` state + a `recomputeCompletion` helper that uses `rowToAscii` + `equationsEquivalent` against `guidedLines[k].equation`.
  - Add an `editActive(line)` lock helper used by the keystroke handlers (around 1135-1153 global keydown and the textarea handler).
  - Persist `shownNotebookIdx` to `sessionStorage` via two small `useEffect`s.
- `FloatingNumberPanel.tsx` — only to read the new "resumed" idx via existing props; no UI change.

### Out of scope
- Free-write (non-guided) sessions keep today's behaviour: the teacher controls the caret directly.
- No changes to Lesson Note generation, floating-number extraction, or the writing surface visuals.

### Acceptance checks
- Opening an example places the sensor at the first row of lesson line 1; clicking row 5 does nothing.
- Typing the correct equation auto-advances; sensor jumps to next lesson line skipping any blank spacer rows.
- Going back via the FN panel arrow re-enables that line and only that line.
- Closing the tab and reopening lands directly on the next unsolved lesson line.
- Erasing lesson line 1 while lines 2-4 exist does not rewind the active line.
- Erasing the most recent line rewinds active to that line.
- A notebook revealed once is not re-requested on revisit.
