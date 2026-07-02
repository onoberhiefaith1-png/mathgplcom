# Sensor Gap + Blocked ▲ Arrow — Root Cause Fix

## What is going wrong

Both errors come from the same source: the board over-estimates how much vertical space an equation needs.

Every written row's height is measured from the screen (pixels). The code then converts pixels to "extra reserved rows" with a loose threshold. A plain one-row equation like `x + y = 7 (1)` — especially at larger text sizes — measures slightly taller than one row, so the system wrongly reserves 1–2 phantom rows *below* it. This causes:

1. **The gap**: When you finish a line and advance, every advance path adds this phantom padding, then also skips the "reserved" rows — so the sensor lands 3 rows down instead of 1.
2. **The dead ▲ arrow**: The empty rows between the sensor and the equation are flagged as "covered by a structure", so the D-pad refuses to move the sensor up into them.

## The fix

**Rule: the notation decides.** A row only reserves extra rows below it when the math tree on that row actually contains a genuinely tall structure (stacked fraction, matrix, tall radical, big operator). Plain text, superscripts (x²), and normal equations reserve zero rows — no matter what the pixel measurement says.

### 1. Structure-aware `extraRowsFor` (PresentationView.tsx)
- Inspect the row's math tree: if it has no `frac`, `matrix`, `bigop`, or nested tall structure, return 0 immediately — skip the pixel heuristic entirely.
- Only when a tall structure exists, use the measured height to decide how many extra rows it truly spans (fraction = 1, nested = 2+).

### 2. Advance = exactly next row
- Line-sync effect (advance to Line N+1): sensor lands at `last owned row of Line N + 1` — with the corrected `extraRowsFor` this is literally the next row for normal equations, and only pushes further when a real fraction/matrix physically occupies the row below.
- Enter key and Floating-panel advance paths use the same corrected function, so all three paths agree.

### 3. Un-block the ▲ arrow
- `rowCoveredByStructure` automatically stops flagging empty rows below plain equations once `extraRowsFor` is corrected, so `canCursorUp` re-enables and the sensor can roam up through empty space again.
- Verify ▲ stops only at the top of the writable band (just below "Solution").

### 4. Verification
- Playwright run: write `x + y = 7`, advance the Floating Number display, screenshot-confirm the sensor sits on the immediately following row (same gap as between existing lines), and confirm ▲ is enabled and moves the sensor up.
- Repeat with a stacked fraction to confirm tall structures still push the sensor below the whole structure (not row-by-row).

## Files touched
- `src/components/smartboard/PresentationView.tsx` — `extraRowsFor`, `rowCoveredByStructure` (indirect), advance paths.
- Possibly a small helper in `src/lib/smartboard/mathTree.ts` (`rowHasTallStructure`).
