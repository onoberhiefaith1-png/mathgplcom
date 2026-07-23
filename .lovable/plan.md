## Problem

On the Smartboard, tapping chips like `2`, `+2`, `+4` writes them onto the active line, but each character shows a visible gap around it — e.g. `2 + 2   +4`. The user wants chips to sit tight next to each other; a visible gap should appear only when the physical **Space** key is pressed.

## Root cause

`src/components/smartboard/MathTreeRender.tsx` renders an **invisible tap zone before every node** (0.22em) plus a **trailing tap zone** (0.3em / 1em at root). These are intentional targets so a user can tap between chips to place the caret — but they consume horizontal space, so every pair of characters ends up with ~0.22em of empty space between them. Char nodes themselves render with `whiteSpace: "pre"`, so real space characters would render correctly if inserted.

Verified: no space is inserted by chip taps (`insertAscii` strips whitespace in `asciiToNodes`, line 40 of `nodeUtils.ts`), and the physical Space key is not currently bound to insert a character on the smartboard — so a user pressing Space today does nothing.

## Fix

1. In `MathTreeRender.tsx` `RowView`:
   - Convert the inter-node tap zone from an inline element with `width: 0.22em` to a **zero-layout hit area** — an absolutely-positioned overlay sitting on the left half of the following node so taps still land between chips, but it no longer pushes the chips apart. Practically: wrap the node in a `position: relative` span and put the tap zone as `position: absolute; left: -0.15em; width: 0.3em; top: 0; bottom: 0;`.
   - Shrink the trailing (non-root) tap width from `0.3em` to `0` visually by making it absolutely positioned as well, extending past the row's right edge. Keep the root's `1em` trailing zone unchanged so tapping past the last chip on the root line still places the caret at end.

2. Bind Space on the physical keyboard to insert a real space character on the active line, so the user's stated "gap only when I press Space" behavior works:
   - In `PresentationView.tsx` (or wherever `insertAscii` is wired to keydown for the smartboard active line), add `if (e.key === " ") { insertAscii(" "); e.preventDefault(); return; }`.
   - Extend `asciiToNodes` in `src/lib/smartboard/nodeUtils.ts` to preserve `" "` as a `char` node (currently `\s+` is stripped). Only strip leading/trailing whitespace; keep interior spaces as `mkChar(" ")`.

Char nodes already render with `whiteSpace: "pre"`, so a `mkChar(" ")` will display as a visible gap of exactly one space.

## Verification

- Tap `2`, `+2`, `+4` in sequence — the line reads `2+2+4` with no visible gap between chips.
- Tap between two chips — caret still lands between them (overlay hit zone still works).
- Press Space on the physical keyboard — a visible space is inserted at the caret.
- No change to lesson-note writers, chip validation, or grading.

## Files touched

- `src/components/smartboard/MathTreeRender.tsx` — reflow inter-node and trailing tap zones as absolute overlays.
- `src/components/smartboard/PresentationView.tsx` — add Space keybinding to insert a real space.
- `src/lib/smartboard/nodeUtils.ts` — allow interior spaces to survive `asciiToNodes`.
