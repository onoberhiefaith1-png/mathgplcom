# Mark every table row as it is completed (T1.1, T1.2, T1.3)

Right now only the last row of a table gets marked. Each row inside a table branch must be assessed and awarded the moment it is complete, exactly like an ordinary solution line.

## What is happening

Table rows are graded from their cells (correct value in the correct cell), and that grading logic already works. But the two places that *trigger* grading both look at board ink, not at table cells:

- Leaving a line (T1.1 → T1.2) only grades when the line has written ink on the board. A table row has no board ink, so the row is dropped as "an attempt that never existed" and never graded.
- The idle auto-check watches board ink too, so typing into cells never re-arms it.

The result: rows 1 and 2 silently pass by, and only the row the student happens to be sitting on when things settle gets marked.

## What changes

1. A table row is graded the instant its cells are complete — before the activity advances to the next row. Completion of T1.1 marks T1.1, completion of T1.2 marks T1.2, and so on.
2. Leaving a table row grades it from its cells instead of requiring ink, so a partially wrong row still records its verdict (and its zero) rather than disappearing.
3. The idle auto-check also reacts to cell edits, so a completed final row is never left unmarked just because the student stayed on it.
4. Grading stays once-per-line: a row already recorded keeps its awarded marks and is never re-marked or double-counted.
5. No change to what students see on the board. Verdicts continue to appear only in the Evaluation panel, and the running score/marks total now reflects every completed row.

## Technical notes

- `src/components/smartboard/PresentationView.tsx`
  - In the table completion effect (the one calling `isLineComplete` / `nextOpenLine` / `isGroupComplete`), call `gradeTableTrackThroughCells(activeLineIdx, "auto")` for the completed row before advancing `activeLineIdx`/`floatingLineIdx`. Guard with a ref set of already-graded `questionId:lineId` slots so re-renders cannot fire it twice.
  - In the attempt-lifecycle END POINT effect, treat a table line specially: when `groupForLine(tableGroups, prev)` exists, run `silentAutoCheckLine(prev)` regardless of `ascii.trim()`, and skip the `reasoning.cancel(prev)` path so table attempts are not discarded for having no ink.
  - Add `tableEntries` to the idle auto-check effect's dependency list so cell edits restart the 1.5s debounce.
- `gradeTableTrackThroughCells` already short-circuits on `solvedSlots`, so all three paths converge on one award per row; no changes to `src/lib/smartboard/tableActivity.ts` are needed.
- Verify with a 3-row table in the test board: row 1 marked on completion, row 2 marked on completion, row 3 marked on completion, total marks = sum of the three rows.
