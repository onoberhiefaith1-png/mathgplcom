# Fix Highlighting → Generating → Notes workflow

Three stages stay strictly separate: the Highlighting Page selects, the Generating Page only builds what was selected, and everything unselected becomes Notes that show on the Smartboard.

Most of this law already exists in the code (diagrams are already Notes-layer only, and unhighlighted prose already becomes a note that rides the entry above it). Two real leaks remain, both in the "nothing was highlighted" fallback paths, plus one missing guarantee for diagram notes.

## What changes

### 1. The Generating Page stops re-interpreting the solution
Today, when a subsection has no saved highlights, the Generating Page seeds a floating line from *every* line of the raw solution. That is the page inventing content the teacher never selected.

New behaviour: the Generating Page renders only what the Highlighting Page saved. With no highlights it shows an empty state — "Nothing highlighted yet" with a button back to the Highlighting Page — and generates nothing.

### 2. The Smartboard stops floating unhighlighted solution lines
The Smartboard has the same fallback: with no highlights it turns every solution line into floating fragments. That is removed.

Instead, when nothing is highlighted the Smartboard builds **notes-only** rows from the same solution: unhighlighted prose becomes note text and every diagram attaches as note content. So a lesson where the teacher highlighted nothing still shows its diagram and explanations on the board — it simply has no floating numbers.

### 3. Diagram notes are guaranteed to reach the Smartboard
The Smartboard currently drops any saved highlight row whose object is not a table. If a legacy row carried diagrams in its note, those diagrams vanished with it. That filter is changed to keep the row's note content (prose + diagrams) while still refusing to make the diagram a floating line.

### 4. One diagram, three destinations
No new diagram copies are created anywhere. The Highlighting Page, the Generating Page and the Smartboard all render the same captured diagram object, identified by its persistent `diagramId`, and the note attachment step only records *which entry owns it* — never a second version of the drawing.

## Confirmed rulings (from your answers)
- Diagrams stay visible on the Highlighting Page but are never highlightable. They are always Notes.
- Unhighlighted content that reads as an equation is still not turned into note prose; only explanation text becomes a Note.

## Technical detail

- `src/pages/FloatingNumbersPage.tsx`: drop the `linesFromSolution(solution)` seeding branch and the legacy "show persisted lines with no highlights" branch; add an empty state with a link to `/lesson-notes/:notebookId/floating-prep/:subsectionId`.
- `src/lib/smartboard/presentation.ts`: replace the `solutionLines.map(... fillersFromEquation ...)` fallback with a notes-only builder that reuses `readSolutionObjects` + `assignNoteObjects` from `src/lib/floating/solutionItems.ts` and the existing prose filter, emitting rows with `notebookOnly: true`, empty `fillers`, and `noteObjects`.
- `src/lib/smartboard/presentation.ts`: change the `rawHighlights` pre-filter so a non-table object row is converted into a note-only row carrying its `noteObjects` instead of being discarded.
- No schema change. `floating_highlights` remains the single source of truth for what floats; `floating_lines` / `floating_bucket` remain derived from it.

## Acceptance check
- Highlight `AB`, `BC`, `∠BCA` in a solution that also contains a diagram and an explanation → Generating Page lists exactly three rows; the diagram appears as note content, never as a chip.
- Highlight nothing → Generating Page shows the empty state; the Smartboard still shows the diagram and explanation as notes with no floating numbers.
- The diagram on the Smartboard is the same object as in the lesson note (same `diagramId`), not a redrawn copy.
