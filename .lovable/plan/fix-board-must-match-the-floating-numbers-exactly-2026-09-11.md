# Fix: board must match the Floating Numbers exactly

Two faults, both in the step that copies Floating Numbers onto a board.

1. **Structure is flattened.** A chip like `2x²` reaches the board as `2x2` — the small raised square drops to normal height. The panel shows each chip on its own, so it always looks right there; the board re-reads the chip as text, and when the base and the raised character get separated (chips joined with a space, or a chip written across two pieces) the raised character is no longer recognised as a power and is printed at full height.

2. **Lines get merged.** The Lesson Note test board keeps one board line per Floating Number line, because it is built line by line. The main board and the classroom board are built from the note instead, and that builder has a fallback that hands over a flat list of chips with **no line boundaries at all**; downstream that flat list becomes a single line, so every line's chips pile onto one row. The same flattened result is then sent to students over the live channel.

## What will change

### Keep every raised/lowered character
- In the note-to-board converter, recognise a raised or lowered character even when it is the first thing in the piece being converted, by carrying the base from the text written immediately before it instead of giving up.
- Stop splitting a chip from its neighbours in a way that separates a base from its power: when a line's chips are written together, they are converted chip by chip and joined as already-structured content, never re-parsed from one glued string.
- Round-trip guard: after conversion, the board content for a line must carry the same number of powers/indices as the Floating Number chips for that line. If it does not, the line is converted again chip by chip rather than shipped flat.

### Never merge Floating Number lines
- The note-to-board builder will always emit one board line per Floating Number line. Where it currently falls back to a flat chip list, it will rebuild the boundaries from the stored per-line ranges the note already saves (`floating_bucket.byLine`, which records each line's start/end position in the flat list).
- The shared line builder's "no boundaries" branch becomes a last resort that also accepts those ranges, so a flat list can still be split correctly instead of collapsing to one line.
- Board-row ownership: each Floating Number line writes to its own row; a second line can never append to a row already owned by another line.
- The live channel carries the per-line structure, so students see the same sequence as the teacher.

### Verify on the real question
- Reproduce with the question currently open (the quadratic-formula subsection, 15 saved lines) on all three boards: Lesson Note test board, main Smartboard, classroom Smartboard. Confirm the same number of lines, the same order, and identical chip appearance (powers, fractions, roots, empty boxes) in each.
- Add tests covering: `2x²`/`2s²` and `5²` keeping their power on the board; a line whose chips are written together keeping every power; a note whose per-line data is missing still producing 15 separate lines from the saved ranges; and no two lines sharing a board row.

## Technical notes

- Structure: `src/lib/smartboard/mirrorFromLessonNote.ts` (`liftUnicodeScripts` base test, and per-chip conversion instead of `fillers.join(" ")` at `PresentationView.tsx` ~5098), plus the paragraph split in `boardWriter/directWrite.ts`.
- Merging: `src/lib/smartboard/presentation.ts` (~738-771 bucket fallback leaves `lines: []`) and `src/lib/smartboard/floatingShared.ts` (~22-32 treats empty `lines` as one line). Reference implementation to match: `src/lib/assessments/assessmentBoardSource.ts`.
- Row ownership: `pickFloatingNumberReal` / `rowOwnersRef` in `src/components/smartboard/PresentationView.tsx`.
- Out of scope: the Lesson Note test board's own logic, board styling, timers, marking, and unrelated Smartboard behaviour.
