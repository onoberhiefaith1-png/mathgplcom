# Tables: two separate floating-number sets (Row/Column and Subcell)

The Normal/Advance switching works and stays as it is. This plan keeps the two sets of floating numbers apart, sends each click on the student board to the right set, and keeps the question and table as separate items on the Smartboard.

## The fault, confirmed in the code
On the Generated Floating Numbers page, Generate replaces **every** line the table has. So Generate in Subcell wipes out the Row/Column lines you made before, and Generate in Row or Column wipes out the Subcell lines.

## What changes

**1. Two sheets under each table (Generation page)**
- Row and Column share Sheet 1. Subcell is Sheet 2.
- Each sheet keeps its own lines and settings. Only one sheet shows at a time, in the area under the table. Switching slides the other sheet into view and never deletes or remakes anything.
- Generate rebuilds only the sheet you are on:
  - Row/Column Generate replaces only the Row/Column lines.
  - Subcell Generate replaces only the Subcell lines.
- Moving between Row and Column stays inside Sheet 1, as it works now.
- Only Sheet 1 lines are numbered in the main line list, so the lesson doesn't get crowded. The Subcell lines are kept with the table and belong to their own cells.

**2. Student board: where you click decides which set you get**
- **Normal mode:** every cell uses the Row/Column numbers. Subcell numbers never show.
- **Advance mode, below the blue line:** works like Normal mode and uses the Row/Column numbers.
- **Advance mode, above the blue line:** shows only that cell's own Subcell numbers (for example 3, ×, 2). Another cell's numbers never appear.
- The floating display, the active line and the highlighted cell always stay on the set you picked last.

**3. Calculate**
- Calculate sits with Collapse, Sum Row, Sum Column, Advance and Clear.
- It works out whatever the student built in the part of the cell they are using. Above the line, the answer goes into that cell's answer. Below the line, it fills the normal cell.

**4. Question and table stay separate on the Smartboard**
- The question text is one item. The table sits below it as its own item, with space between them. Neither is ever squeezed beside the other or joined to it.

**Unchanged:** how the numbers are worked out, how Advance looks and switches, and every table that has no Subcells.

## Acceptance test (taken from your notes)
1. Choose Column and press Generate. Then switch to Subcell and press Generate. Switch back to Column: the Column lines are exactly as they were.
2. Switch back to Subcell: its lines are still there, without generating again.
3. On the student board with Advance on: clicking below the line shows the Row/Column numbers. Clicking above the line shows only that cell's Subcell numbers. A different cell shows its own.
4. In Normal mode, Subcell numbers never appear.
5. Calculate works in both parts of a cell.

## Technical details
- The table config in `FloatingNumbersPage` gains `rcOrientation` ("row" | "column") and `view` ("rc" | "subcell"). Today the single `orientation` field covers both.
- Each `FloatingLine.table` gets a `set: "rc" | "subcell"` tag. Old lines without a tag count as rc, or as subcell when their orientation is "subcell". `generateTable` splices out only the lines whose set matches. Subcell lines are saved in `floating_highlights` (the table payload's `subcellLines`, keyed by cell). They stay out of the numbered `lines` stream, so `compileBucket` and numbering only see rc lines. No migration is needed.
- `TableWorkspace` shows two stacked panels with a slide transition. The Row/Column toggles control panel 1 and Subcell controls panel 2.
- `tableActivity.ts` `buildTableGroups` attaches `subcellLines` to the group. `TableActivityStage` sends upper-zone clicks to that cell's subcell line and lower-zone and Normal clicks to the rc member line. `FloatingDisplayStrip` gets the fillers of whichever line is active.
- Calculate reuses `calculateActive` and adds a lower-zone path that uses the same evaluator.
- `presentation.ts` / the Smartboard composition renders the question block and the table group as separate stacked elements.
- Tests: two-sets persistence in `tableGrid`/page helpers, and routing in `tableActivity`.
