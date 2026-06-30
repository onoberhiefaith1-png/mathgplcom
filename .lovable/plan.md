## Plan: Smart Sensor + One-to-One Lesson Sync

### 1. Stop the sensor from resetting while typing
- Remove the effect behavior that re-anchors the sensor to the first empty row after every character.
- While a teacher is typing on the active line, the sensor/caret must stay inside that line and move right with each inserted object.
- Auto-reposition only happens at clear checkpoints: opening a Solution, pressing Enter, confirming a notebook note, completing the expected line, or using the cursor scrollbar.

### 2. Define the sensor as an active writing target
The sensor will have one job: point to the current writable Lesson Line inside the active Solution.

Rules:
- It appears by default under “Solution” only when no solution content exists yet.
- If solution content exists, it appears one writable row below the last written equation/note.
- It never parks on a written row, notebook/prose row, heading, question, caption, restricted region, or the visual area covered by a tall math structure.
- It remains visible at all times inside a writable Solution.

### 3. Add smart row search for movement
Create one shared helper for cursor placement:

```text
findNextWritableEmptyRow(startRow, direction)
```

It will:
- Scan row by row in the requested direction.
- Skip restricted rows.
- Skip rows already containing ink.
- Skip rows visually covered by fractions, roots, matrices, powers, or other tall structures.
- Grow the working area if the teacher scrolls downward past the current Solution band.

This same helper will be used by:
- Initial sensor placement.
- Enter key movement.
- The left ↑/↓ scrollbar.
- Auto-advance after a completed line.
- Notebook note insertion.

### 4. Fix the left ↑/↓ scrollbar behavior
- The scrollbar will move only the sensor, not floating numbers.
- ↑ moves to the previous available empty writable row, never into written/restricted content.
- ↓ moves to the next available empty writable row, growing the Solution space if needed.
- If the immediate next row is blocked, the sensor jumps over it to the next clean space.
- The sensor always snaps to the master left margin when moved vertically.

### 5. Preserve typed order exactly
Fix the insertion flow so typed content appears in the same order the teacher enters it:

```text
Teacher types: x² = 5x + 6
Board shows:   x² = 5x + 6
```

Implementation rule:
- Typing must never reset the math-tree cursor to the beginning of the line.
- The cursor only resets to `{ path: [], index: 0 }` when starting a new empty line.
- After each inserted character/chip/structure, keep the returned cursor position as the live cursor.

### 6. One-to-one sync with notebook notes
When the teacher presses the notebook/note action:
- If the current typed line matches the expected lesson note/line, show the note confirmation behavior.
- Write the notebook note onto the board exactly once.
- Mark that note as completed/read.
- Move the active lesson step to the next line.
- Move the sensor to the next writable empty row below the note.

### 7. Structure-aware next-line placement
All vertical movement will use actual rendered structure height:
- If the current line contains a fraction/root/matrix that occupies multiple rows, the next sensor position is below the full structure.
- No cursor can land inside the denominator area, radical area, matrix body, or any occupied bounding box.

### 8. Keep floating numbers independent
- Floating Number panel line navigation remains separate from cursor movement.
- The sensor follows lesson progress, not the floating-number display scrollbar.
- Floating numbers may still auto-follow the active lesson line, but manually browsing floating numbers must not move the writing cursor.

### 9. Verification
I will verify:
- The sensor is visible below Solution on load.
- Typing `x² = 5x + 6` preserves order.
- The caret moves right as typing happens.
- Pressing Enter moves below the current line/structure.
- The ↑/↓ cursor scrollbar jumps only to empty writable rows.
- Notebook insertion moves the sensor below the inserted note.
- The sensor never lands on questions, headings, notes, existing equations, or restricted regions.