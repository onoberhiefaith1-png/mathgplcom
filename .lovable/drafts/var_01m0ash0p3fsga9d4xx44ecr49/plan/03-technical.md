## Technical notes

All changes live in `src/components/lessonnotes/extensions/visuals/smarttable/SmartTable.tsx`.

**Toolbar removal**
- Drop both `<SmartTableCellToolbar …/>` renders (header cell at ~686 and body cell at ~742) and the import. The component file can stay unused or be deleted.
- Keep `cellCopy` / `cellCut` / `cellDelete` / `cellDuplicate` only if still referenced; keep `cellAiEdit`.
- Add a single **AI Edit** button to the existing selected-table control strip (~line 768) that calls `cellAiEdit()` against the last-touched cell (`active` or `softCell`), with a toast when no cell has been chosen.

**Summation fix** — the mode itself is intact; the result is being overwritten. When Σ mode is active and the teacher clicks the destination cell, the previously edited cell blurs and `finishEdit` runs *after* the sum patch, writing `cells.map(...)` from its stale render-time closure and reverting the total.
- Make `finishEdit` and `writeCell` read `modelRef.current` instead of the render-time `cells` / `headers`, so any two writes in the same tick compose instead of clobbering.
- In `handleCellClick`, when `sumMode` is set: `cancelEdit()` first (discard the in-flight editor without committing), then compute and write the total, then clear the mode.
- Guard the editor's blur path so a blur caused by entering Σ mode cannot commit stale content.
- `sumRow` / `sumCol` keep using `cellNumber` from `evaluator.ts` (plain numbers and solvable expressions count, text and empty cells are skipped, the header row is never included in a column sum). Read the row/column from `modelRef.current.cells`.
- Selecting a row/column handle still cancels Σ mode (`selectLine`), and Escape still cancels.

**Verification** — drive the lesson-note page in a browser: type `2`, `7`, `9` across a row confirming no toolbar appears, run Σ → Sum Row on the next cell and check `18`; repeat down a column with Σ → Sum Column.
