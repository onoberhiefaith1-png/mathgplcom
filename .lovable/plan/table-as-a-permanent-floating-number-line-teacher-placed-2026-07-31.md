# Table as a permanent Floating Number line (teacher-placed)

The Smart Table itself is not redesigned. Only its relationship to the Floating Number system changes: the table stops being something the board decides to show and becomes a permanent lesson line represented by a table icon that the teacher taps to place.

## What is true today

- A table's rows already collapse into one lesson step, and clicking a cell already switches the counter to `T1…Tn` (`lessonSteps`, `tSeriesFor` in `src/lib/smartboard/tableActivity.ts`).
- `Delete` already only hides the visual instance (`hiddenTables`) and preserves entries, orientation, retention and mappings; `Clear` already wipes only student entries.
- Two things break the model:
  1. The table renders automatically whenever its lesson step becomes active (`activeTableGroup && !activeTableDeleted` in `PresentationView.tsx`). The system, not the teacher, places it.
  2. When the table is hidden there is an effect that force-advances the lesson past the table's member lines, so the teacher can no longer stand on Line 5 and can never get the table back.

## Correct behaviour

### The trunk never breaks

Lesson navigation is always 1 → 2 → 3 → 4 → 5 → 6 → 7, whether or not the table is on screen. Line 5 is permanently the Statistics Table. Nothing skips it, nothing removes it.

```text
Line 4
Line 5  📋 Statistics Table ──┬── T1
Line 6                        ├── T2
Line 7                        └── T3
```

### The line shows a table icon, not equations

When the active lesson step is a table, the Floating Number bar shows one chip: the table icon (with the table's label as its tooltip). No equation chips, no text. The counter reads that step number as usual.

### Tapping the icon places the table

Tapping the table chip inserts the table onto the board at the teacher's current cursor row, exactly like tapping any other floating number writes at the cursor. The board never places it on its own. Tapping again after a Delete re-inserts it — unlimited times, at whatever cursor position is current.

### Inside the table

Once a cell is clicked the panel switches to `T1…Tn` for that table. Leaving the table (moving to another lesson step, collapsing, or removing it from the board) restores lesson numbering immediately. Identical in Lesson Mode and Present Mode.

### Delete and Clear

- `Delete` = remove the visual instance from this board view only. Line 5, the branch, the T-series, orientation, retained cells, formulas, headings, assessment mappings and student entries all survive.
- `Clear` = remove every student-entered value only; everything the teacher designed stays.

Both already exist on the table toolbar; `Delete` is relabelled to make its meaning explicit and no longer moves the lesson.

## Technical notes

`src/components/smartboard/PresentationView.tsx`
- Replace the `hiddenTables` hide-list with a `placedTables: Record<objId, { row: number }>` map — a table renders only when it has an entry. This inverts the default: nothing on the board until the teacher places it.
- `placeTableAtCursor(group)` writes the current sensor/cursor board row into `placedTables`, then expands the table; the render block anchors the stage to that stored row instead of `groupAnchor(...)`. Re-placing overwrites the row.
- `deleteTableObject` deletes only the `placedTables` entry (keeps `tableEntries`, expansion memory, orientation, retention, mappings) and clears `activeTableObjId`.
- Delete the effect that force-advances the lesson past a hidden table's member lines. Line 5 must remain a valid, reachable cursor position with no table on screen.
- `tableValidationState` becomes gated on "placed" rather than "not deleted"; when unplaced there is no active snapshot, and the broadcast payload is unchanged otherwise.
- Pass a new `tableChip` descriptor (`{ objId, label, placed }`) to `FloatingNumberPanel` whenever the active lesson step is a table, plus an `onPlaceTable` callback.

`src/components/smartboard/FloatingNumberPanel.tsx`
- When `tableChip` is set, render a single table-icon chip in place of the normal chip flow (chip geometry, used/unused rotation and reveal logic untouched for ordinary lines). Tap calls `onPlaceTable`. Chip shows a subtle "on board" state when already placed so a second tap reads as re-placing.
- Counter/T-series prefix behaviour stays as it is.

`src/components/smartboard/TableActivityStage.tsx`
- Relabel the delete action to `Remove from board` with its explanatory tooltip and keep `Clear` next to Expand/Collapse. No other change.

Unchanged: Smart Table editor, orientation, retention, cell calculator, Σ, AI Edit, formatting, sync, the Floating Number engine, and the neutral (no ticks/marks) board.
