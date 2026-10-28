# Mark every table track as it is completed (T1.1, T1.2, T1.3)

Right now only the last track of a table gets marked. Each track inside a table branch — a row when the teacher set Row orientation, a column when they set Column orientation — must be assessed and awarded the moment it is complete, exactly like an ordinary solution line. The teacher's chosen orientation is the only thing that decides what "one track" means; the marking rule is identical either way.

## What is happening

Table tracks are graded from their cells (correct value in the correct cell), and that grading logic already works. But the two places that *trigger* grading both look at board ink, not at table cells:

- Leaving a line (T1.1 → T1.2) only grades when the line has written ink on the board. A table row or column has no board ink, so the track is dropped as "an attempt that never existed" and never graded.
- The idle auto-check watches board ink too, so typing into cells never re-arms it.

The result: tracks 1 and 2 silently pass by, and only the track the student happens to be sitting on when things settle gets marked.

## What changes

1. A table track is graded the instant its cells are complete — before the activity advances to the next track. Completion of T1.1 marks T1.1, completion of T1.2 marks T1.2, and so on. Under Row orientation a track is one row; under Column orientation it is one column.
2. Leaving a table track grades it from its cells instead of requiring ink, so a partially wrong row or column still records its verdict (and its zero) rather than disappearing.
3. The idle auto-check also reacts to cell edits, so a completed final track is never left unmarked just because the student stayed on it.
4. Grading stays once-per-line: a track already recorded keeps its awarded marks and is never re-marked or double-counted.
5. No change to what students see on the board. Verdicts continue to appear only in the Evaluation panel, and the running score/marks total now reflects every completed row or column.

## Technical notes

- `src/components/smartboard/PresentationView.tsx`
  - In the table completion effect (the one calling `isLineComplete` / `nextOpenLine` / `isGroupComplete`), call `gradeTableTrackThroughCells(activeLineIdx, "auto")` for the completed track before advancing `activeLineIdx`/`floatingLineIdx`. Guard with a ref set of already-graded `questionId:lineId` slots so re-renders cannot fire it twice.
  - In the attempt-lifecycle END POINT effect, treat a table line specially: when `groupForLine(tableGroups, prev)` exists, run `silentAutoCheckLine(prev)` regardless of `ascii.trim()`, and skip the `reasoning.cancel(prev)` path so table attempts are not discarded for having no ink.
  - Add `tableEntries` to the idle auto-check effect's dependency list so cell edits restart the 1.5s debounce.
- `gradeTableTrackThroughCells` already short-circuits on `solvedSlots`, so all three paths converge on one award per track. Track membership, completion and labelling already come from the orientation-aware helpers (`cellKeysForLine`, `editableCellsForLine`, `isLineComplete`, `trackLabel`), so no changes to `src/lib/smartboard/tableActivity.ts` are needed and both orientations run through the same code path.
- Verify both orientations in the test board: a Row-oriented 3-row table marks row 1, row 2 and row 3 each on completion; the same table set to Column orientation marks column 1, column 2 and column 3 each on completion. Total marks = sum of the tracks.

