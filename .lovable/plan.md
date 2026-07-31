# Session 1 — Tables as Floating Number Workspaces

A table stops being a picture in the solution and becomes a mini workspace that produces several Floating Number lines. Scope for this session: the Smart Table engine only. Long division, division ladder, place-value chart and base conversion stay untouched; later they become adapters that translate their layout into this same engine, never a second solving system.

## What the teacher gets

On the Generated Floating Numbers page, every highlighted table renders as a live grid with three independent controls sitting together above it:

- **Orientation** — Row-Oriented (default) or Column-Oriented. Pure configuration. Changing it alone changes nothing.
- **Generate** — a rebuild, not an add. It discards the table's previous automatic lines and recreates them from the current orientation.
- **Retention** — a mode. While active, every cell the teacher clicks becomes retained. Retained cells are copied into the student's table exactly as written and are read-only. Everything else is blank for the student. The system never guesses; headings are not special.

Plus **+ Add Line** for manual assignment: creates one empty Floating Number line, then the teacher clicks cells into it. The orientation rule is enforced live — once a cell from row 3 is in the line, cells from any other row are rejected with a short warning and never added. Column-Oriented behaves identically on columns.

### Example

```text
x    x²   x² − 3
2    4    1
4    16   13
6    36   33
```

Row-Oriented + Generate gives three lines: `2 4 1`, `4 16 13`, `6 36 33`.
Column-Oriented + Generate gives three lines: `2 4 6`, `4 16 36`, `1 13 33`.

## Dynamic expansion and renumbering

In the Lesson Note the table is still one object. On the Floating Numbers page it expands into as many lines as the orientation dictates, inserted at the table's position in document order. Everything after the table renumbers automatically, so a lesson of Equation / Table / Equation / Equation with a three-row table reads as lines 1–6 with the table occupying lines 2–4. Each table carries its own orientation, retention set and lines; tables never affect one another.

## Cells hold mathematics, not numbers

A cell is a container for a whole expression: `5 remainder 2`, `3/8`, `√5`, `log(245) = 2.3892`, `10²`, `45 ÷ 2 = 22 remainder 1`. The engine takes the complete cell content as one floating unit and does not split or reinterpret it.

## Student side

The student Smartboard renders the table for the active line: retained cells shown read-only, non-retained cells blank and answerable. Assessment follows the orientation — one row at a time, or one column at a time, never the whole table at once. The presenter view, the floating display and the active table cell stay on the same active line, so a student can never be answering row 1 while the display shows row 3.

## Technical notes

- **Data model.** Extend the saved solution-object highlight with a `table` payload: `orientation`, `retained` (cell keys `r:c`, `-1:c` for headers), and `lines` (each an ordered list of cell keys plus a `manual` flag). Persisted in `notebook_subsections.floating_highlights` alongside today's object highlights — additive, no migration needed for the highlighting page.
- **Grid reader.** A small `src/lib/floating/tableGrid.ts` normalises a captured Smart Table node's attrs (`rows`, `cols`, `headers`, `cells`) into `{ headers, cells, cellKey, cellValue }`. Adapters for other structures will implement this same interface later.
- **Workspace UI.** New `TableWorkspace` component on `FloatingNumbersPage`, rendered for each highlight whose object family is `table`, containing the Orientation segmented control, Generate, Retention toggle, + Add Line, the clickable grid and the resulting line chips.
- **Expansion into the line stream.** Table lines materialise as normal `FloatingLine` entries (fillers = cell contents) tagged with `tableObjId` + `cellKeys`, spliced at the table's `afterLine` position so existing numbering, marks and `compileBucket` keep working unchanged. Regeneration replaces only that table's non-manual lines.
- **Downstream.** Remove the current defensive skip in `src/lib/smartboard/presentation.ts` for table objects so table-derived rows reach the Smartboard, keeping the skip for diagrams. Presentation rows gain the retention mask and the grid so the student board can render the table for the active row/column.
