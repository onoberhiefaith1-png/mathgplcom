## What's changing

1. **Delete the "note already on the board → skip" rule.** Every click of the note button writes a new copy. Ten clicks = ten copies. Undo (back) removes them. This is the fix for line 8/9 not showing.
2. **Rebuild the note-write code from scratch.** Not amend — delete the existing note path in `floatingChannel.ts` and `previewChannel.ts` (and the ledger's `findTextRow` short-circuit for notes) and write a fresh, minimal function that runs identically for line 1 and line ∞.
3. **Note-gate glow** on advance: if the teacher moves to the next line while the current line has an unclicked note, the note icon glows. The glow clears the moment the note is clicked. (Uniform for every line.)
4. **Placeholder lifecycle tied to the line lock:**
   - Line locks (teacher advanced past it) → any placeholder-only ink on that line is hidden.
   - Teacher moves the Floating Number Display back to that line → the line unlocks, the placeholder reappears **editable**.
5. **Green highlight follows the sensor, both directions:**
   - As the sensor moves line 1 → 2 → 3, the Presenter Preview's green highlight advances line-for-line.
   - As the Presenter Preview / Present Mode moves line 2 → 3 → 4, the board's live highlight advances too.
   - The preview panel auto-scrolls so the highlighted line sits near the middle.

## How it will be built

### A. Fresh note-write module

- New file `src/lib/smartboard/boardWriter/writeNote.ts` — one exported function `writeNoteOnce(lineIdx, text, host)`:
  - trim, mirror to a row, ask the ledger for `nextFreeRow(lineIdx)`, commit through the dumb primitive, lock the landed rows, mark note shown for that line, scroll.
  - **No** existing-signature check. **No** repeat-detection. Every call writes.
- Delete the current note branches inside `floatingChannel.ts` and `previewChannel.ts` and route both to `writeNoteOnce`.
- Delete the `findTextRow` usage for notes; keep `findTextRow` around only for beat/section navigation if still needed.

### B. Note-gate glow (uniform)

- Single source: `noteGateOpen(lineIdx)` in `PresentationView`. Already exists — audit so it fires identically for every line: glow when Next is pressed on a line whose note text is non-empty and hasn't been clicked this session. Click clears the glow immediately.

### C. Placeholder sweep and revive

- Add `isPlaceholderOnly(row)` in `mathTree`/`rowAscii`: row contains only structural nodes whose slots are empty.
- On line lock (advance), sweep the just-locked line's owned rows: any row that is `isPlaceholderOnly` is removed from `freeLines` + `rowOwners` + any highlight state. Placeholder is gone from the screen.
- On unlock (Floating Number Display moves back to that line), restore the placeholder by re-inserting the empty structural node at the line's own row. It's now editable — the line is no longer in `notebookRowLines`.

### D. Bi-directional green highlight + auto-scroll

- The `activePreviewLineIdx` prop already flows Smartboard → PresenterPreview. Verify it advances on every sensor move (not just chip taps) and that the preview panel scrolls the highlighted card to its vertical center on change.
- The reverse (Preview click / Present Mode click → board highlight) is what `previewChannel` already does when it delegates chip/line writes. Confirm the board's `activeLineIdx` / sensor line updates on those clicks so the green highlight moves both ways.
- Add a small `scrollIntoView({block: "center"})` in `PresenterPreviewPanel` on every `activeLineIdx` change (guarded by the existing "manual scroll paused" flag).

### E. Verification

- Unit test: click note 5x on the same line → 5 rows written, all owned by that line, all locked.
- Unit test: `isPlaceholderOnly` — empty frac, empty √, empty power, empty bracket, mixed w/ whitespace.
- Unit test: lock → sweep removes placeholder; unlock → placeholder reappears editable.
- Playwright on the current lesson: solve past line 8, click every note 1..N (Floating & Present); tap fraction, leave empty, advance, confirm placeholder gone; move sensor 1→8, confirm preview highlight & auto-scroll follow; click preview line 6, confirm board highlight jumps to line 6.

### Files touched

- new: `src/lib/smartboard/boardWriter/writeNote.ts`
- rewrite: note branches of `boardWriter/floatingChannel.ts`, `boardWriter/previewChannel.ts`
- edit: `boardWriter/ledger.ts` (retire `findTextRow` for notes)
- edit: `mathTree.ts` or `rowAscii.ts` (add `isPlaceholderOnly`)
- edit: `PresentationView.tsx` (lock sweep, unlock revive, sensor→highlight wiring, remove any residual dedupe on note clicks)
- edit: `PresenterPreviewPanel.tsx` (auto-scroll centering on `activeLineIdx` change)
- tests: `writeNote.test.ts`, `placeholderLifecycle.test.ts`; extend `noteSource.test.ts` if needed

Autoplay stays deleted. Sensor flex stays. Two-engine independence stays intact — this touches only the note write path, the placeholder lifecycle, and the highlight sync.
