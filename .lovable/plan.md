# Fix Sensor Movement: Next-Line Jump + Note Advance

## Problems

**1. Floating Number next line — sensor jumps 4–5 rows instead of 1**
When you advance to the next floating line, the sensor-anchor effect in `PresentationView.tsx` computes the landing row by combining several "push down" rules: it starts below the last inked row, then also scans ALL row-ownership entries and pushes the sensor below each one (adding extra rows for tall structures), then skips any row it considers non-writable. Stale ownership entries and double-counted structure heights stack up, so instead of "one row below the last line" you land 4–5 rows down.

**2. Present view — clicking a note leaves the sensor before the note**
When you click a note chip in Present, the note text is written onto the board, but the sensor is never moved. It stays where it was (before the note). Since note rows are locked (not editable), the sensor should land on the first empty row after the note.

## Fix

### A. Next-line advance = exactly one row (plus real structure height only)
- In the sensor-anchor effect, compute the landing row as: one row below the last visibly inked row of the previous line, plus extra rows only if that specific row holds a genuinely tall structure (stacked fraction / matrix).
- Remove the extra "max over all owned rows" push that double-counts rows already covered by the last-ink calculation, and prune stale `rowOwners` entries whose rows no longer have ink so they can't drag the sensor down.
- Keep the note-row / tall-structure skip, but only as a minimal step-over (skip locked rows one at a time), not a compounding offset.

### B. Note click moves the sensor below the note
- Refactor `writeProseLineOnBoard` so the paragraph row placement is computed before committing state, and it returns the last row it wrote.
- In the Present-mode note route (`applyMirror` teacher-note branch in `mirror.ts` and `directWrite`), after the note is written: move the sensor to the first empty writable row below the note's last paragraph (skipping locked note rows), and scroll the board there.
- Same behavior for notes placed via the Floating Number workflow, so both paths are consistent.

### Verification
- Playwright run: place a note in Present view → confirm the sensor lands exactly one row below the note.
- Playwright run: complete a floating line, advance to the next → confirm the sensor lands exactly one row below the previous line (two rows only when the previous line ends in a stacked fraction).

## Technical notes
- Files touched: `src/components/smartboard/PresentationView.tsx` (sensor-anchor effect ~line 2260–2320, `writeProseLineOnBoard` ~line 1154), `src/lib/smartboard/manualEdit/mirror.ts` (teacher-note branches), `src/lib/smartboard/presentationAI/controller.ts` (return type of the prose writer if needed).
- No backend or data changes.
