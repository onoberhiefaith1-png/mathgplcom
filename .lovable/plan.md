# Fix: Presenter Preview note click jumps sensor ~10 rows with no ink

## What's happening

When you click a note in the **Presenter Preview** (Present mode), the sensor drops roughly 10 rows down and nothing gets written. The Floating Number panel works fine — only the Presenter Preview note path is broken.

## Root cause

The Presenter Preview note click calls `writeNoteForLine` (the direct one‑to‑one channel we added). Inside it, the "where should the note land" anchor is computed by scanning:

1. `rowOwnersRef` — rows claimed by earlier lines.
2. `freeLinesRef` — every row that has any visible ink, including chips typed live at the sensor.

The scan picks the **deepest inked row anywhere on the board** as the anchor, even when that row belongs to unrelated ink far below this line (e.g. a previous fraction denominator, a stale sensor row, or empty half‑row artifacts still recorded in `freeLinesRef`). Then `writeProseLineOnBoard` adds another gap for tall structures, plus one‑row‑below advance for the sensor. Result: target = `deepestInk + 1 + tallGap + advance`, which lands far off‑screen — the sensor visibly drops many rows and the ink is either never rendered or written where the teacher can't see it.

The "sensor moves 10 rows down and nothing happens" is exactly this: the writer DID place the note, but so far below the viewport that it reads as invisible, and the sensor advance made the jump obvious.

## Fix

Constrain the Presenter Preview note anchor to **the note's own line**, not the deepest ink anywhere on the board.

1. **`writeNoteForLine` (PresentationView.tsx)** — replace the "deepest ink anywhere" scan with a bounded one:
   - Anchor = the last row **owned by this exact `lineIdx`** in `rowOwnersRef`. If none, anchor = last row owned by any line **≤ lineIdx**.
   - Only consult `freeLinesRef` for ink that sits **at or above that owned anchor + a small window** (e.g. anchor + 2), to catch a tall fraction the line just typed. Never let ink far below the line's own footprint pull the note down.
   - If no owned row exists yet (fresh section), start from `bandStart(activeLayout)` and take the FIRST empty row — never the deepest.

2. **Always scroll to the note after write.** Force `scrollBoardToRow(landedRow)` inside a `requestAnimationFrame` so the teacher sees the ink even when the writer's internal advance also scrolls elsewhere.

3. **Cap the sensor advance for notes.** In `writeProseLineOnBoard`'s `advanceBelow`, when the write originated from a note (pass a flag through `opts`), limit the "walk while blocked" loop to at most 2 extra rows for notes — never 200. If still blocked, park the sensor directly under the note without hunting.

4. **Verify visibly.** After the write, read back the note's row signature via `boardHasTextRow`. If missing, force one plain‑text retry at `landedRow` (already there) — do NOT jump to `deepest + 2` (that's the current bug's escape hatch, which is what pushes the sensor 10 rows down when the initial write actually succeeded but verification lagged a tick).

## Files touched

- `src/components/smartboard/PresentationView.tsx` — `writeNoteForLine` anchor logic + verification retry; `writeProseLineOnBoard` `advanceBelow` capped for the note path.

## Verification

- Playwright end‑to‑end in Present mode: open a notebook with lines 1..N, type lines 1–2 so a tall fraction lives on the board, then click the note on line 3 (and line 4, 5, 6). Screenshot‑assert each note lands directly under its own line, in view, with the sensor at most 1 row below it.
- Repeat‑click a note: must scroll to the existing ink, never jump.
- Confirm Floating Number path still works unchanged.
- Typecheck + full vitest suite.

No backend changes.
