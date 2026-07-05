# Note-glow gate + reliable note placement

Two changes, both in the Smartboard presentation layer. No backend, no data model changes.

## 1. Note must be on the board before Next can advance past its line

Rule (from you):
- Every line with a Teacher Note is a **checkpoint**. You cannot advance to the next line until that note's text is currently on the board.
- Trying to advance while it isn't → the note icon **glows** and Next is blocked for that line only.
- Clicking the note icon (glowing or not) writes the note; once its text is present on the board, the checkpoint clears and Next proceeds.
- If the teacher later erases the note's ink and comes back (Prev then Next), the check re-runs against the *current* board — the note re-glows until it's written again.
- The note icon remains freely clickable at any time regardless of the gate.

How it's wired (in `PresentationView.tsx`):
- Add a helper `hasNoteInkForLine(lineIdx)` that uses the existing `boardHasTextRow(noteText)` against the live reservoir's `notebook` text. Empty note → always true (no gate).
- In the Next handler for guided lines (around the goNext / advance path near line 4170–4200):
  - Before advancing from `curLineIdx`, if `notebookFor(curLineIdx)` exists AND `!hasNoteInkForLine(curLineIdx)`:
    - Do **not** advance.
    - `setNotebookAttentionIdx` to include `curLineIdx` (this is the existing glow state — the note button already renders the glow ring off `notebookAttentionIdx`).
    - Optional short toast / status: "Show the note first."
- When the note is written (via icon click, mirror, or edit), the existing `markNotebookShown` + attention-clear path already runs; add one line to *also* clear attention when `boardHasTextRow(noteText)` becomes true so scrolling back after erasing re-arms cleanly.
- Prev/Next-section buttons are unaffected — the gate applies to the per-line Next only.

## 2. Line-1 note appears far below (or not at all)

Root cause: for the *first* line of a section the row that owns line 1 hasn't been claimed yet when the note is written, so `moveSensorToSafeRow` scans forward and lands on the first empty row it finds, which can be 5–10 rows below because the reset-to-top routine leaves the sensor high and the safety scan skips fraction rows aggressively. It's also racy on refresh: sometimes the equation row is claimed before the note write, sometimes after.

Fix (in `PresentationView.tsx`, note-writing path near line 2033–2065 and in `moveSensorToSafeRow` around 2983):
- Before writing a note for `lineIdx`, ensure the equation row for that line exists:
  - If `getBoardRowSignatureFor(lineIdx)` is empty, first claim the row via `rebuildRowOwnership(lineIdx)` (or the internal equivalent) so the note anchors to "row-after-lineIdx".
- Change note placement from "first safe row from the sensor" to **"row immediately after the row owning `lineIdx`, skipping only true blockers (ink, denominator-of-fraction, existing note row)"**. Cap the forward scan at 2 rows; if both are blocked, insert directly under the equation and let the existing occupancy tick re-flow.
- Add a small retry: if the write's post-check (`boardHasTextRow(noteText)`) is false after one frame, re-run the placement once. This kills the "refresh → nothing → try again → works" flake.
- No changes to note text, styling, or the icon behavior.

## Technical details
- Files touched: `src/components/smartboard/PresentationView.tsx` only.
- Reuses existing state: `notebookAttentionIdx`, `shownNotebookIdx`, `boardHasTextRow`, `writeProseLineOnBoard`, `moveSensorToSafeRow`.
- No controller-interface changes; `mirror.ts` and `autofix.ts` keep working unchanged.
- No console-loop risk: attention state changes only on user gesture (Next click) or on note-write completion.

## Verification
- Playwright: open a lesson, on a line with a note press Next → note glows, board doesn't advance; click note icon → note appears on board directly under the equation, then Next advances. Erase note ink, Prev then Next → note re-glows. Line with no note advances immediately. Line 1 note: refresh 3× and click Next → note lands on the row right below Line 1 every time.
