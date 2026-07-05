# Delete & Rewrite the Line-1 Note Rule

## What is actually wrong with Line 1

Nothing is wrong with the note text itself. The problem is leftover memory: back when notes auto-wrote themselves onto the board, line 1 was recorded as "already shown", and that record is **saved in the browser and re-loaded on every refresh**. So line 1's gate is permanently satisfied — it never glows, Next passes straight through. Lines 2 and 3 were never auto-written, so they glow correctly.

## The fix — delete the old rule, write one clean rule

**1. Purge the stale memory (the true line-1 killer)**
- Stop saving/loading the "note already clicked" set from browser storage entirely, and clear any old saved entries on load.
- Result: every note starts fresh — no line can inherit a "clicked" status from a previous session.

**2. One uniform gate for every line (no special cases)**
- A line with a note blocks Next until **the note's text is actually on the board** — checked live, every time.
- Blocked → the note icon glows. Clicking the icon writes the note onto the board, gate opens.
- Teacher erases the note ink later and scrolls back → gate closes again, icon re-glows. Automatic, because the check is always live against the board.
- Same single function used by Next, the down-chevron, and the reveal flow — deleting the current mix of "clicked set AND board check" that behaves differently per line.

**3. Delete line 1's note text so you can write it again**
- Clear the saved note on line 1 in the database. Line 1 will have no note (no gate) until you re-author it in Floating Prep — exactly as you asked: delete it, you write it again.
- When you save the new note, it goes through the same uniform gate as every other line.

## Verification
- Refresh → go to line 1: with the note deleted, no gate (as requested).
- Re-author a note on line 1 in Floating Prep → return to the board → press Next on line 1: icon glows, Next blocked; click icon → note appears under line 1 → Next works.
- Erase the note ink, Prev then Next → icon re-glows.
- Refresh again → the gate still behaves identically (no stale flags survive).

## Technical details
- `src/components/smartboard/PresentationView.tsx`: remove `SHOWN_NB_KEY` persistence + hydration (clear old keys once on mount); replace the `shownNotebookIdx && boardHasTextRow` compound gate in `goNext`/`stepTo` with a single `noteGateOpen(idx)` = `notebookFor(idx) === "" || boardHasTextRow(note)`; keep `notebookAttentionIdx` purely for the glow.
- One small database update: set `floating_highlights[0].precedingNotebook = ""` for the affected subsection.
