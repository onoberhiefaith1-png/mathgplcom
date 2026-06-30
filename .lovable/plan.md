## What went wrong

Last turn I changed two files in a way that broke how filled fractions/brackets/roots come across from the lesson note onto the Smartboard:

1. `src/lib/floating/highlightEngine.ts` — `nodesToLatex` started emitting **empty groups** (`\frac{}{}`, `\sqrt{}`, `()`) for empty slots instead of the literal `□` it used to emit.
2. `src/lib/smartboard/mirrorFromLessonNote.ts` — `latexToRow` started **dropping `□` characters** entirely.

Together these two changes caused the Smartboard renderer to receive an empty `frac` node (`rows: [[], []]`). Empty rows in `MathTreeRender` paint the dashed-box placeholder UI, which is what you saw as `□` on top and `□ □ □` underneath — not the filled `-b ± √(b² − 4ac) / 2a` you saved in the lesson note.

The lesson note pipeline was working before. I should not have touched it.

## Fix

Revert exactly those two edits so the mirror behaves identically to how it did before my last turn. Nothing else changes.

### File 1 — `src/lib/floating/highlightEngine.ts`

Restore `nodesToLatex` to its prior form:

- `slot` → emits `"□"`
- `frac` → `\frac{num || "□"}{den || "□"}`
- `sqrt` → `\sqrt[deg]{rad || "□"}`
- `bracket` → `open + (body || "□") + close`

### File 2 — `src/lib/smartboard/mirrorFromLessonNote.ts`

Remove the `if (ch === "□") { i++; continue; }` guard I added in `latexToRow`. `□` flows through as a `mkChar` again, exactly like before.

## What I am NOT changing

- **Square-root overline expansion** (stretch-aligned flex in `SqrtView`) — separate concern, working as intended.
- **Line locking** in `PresentationView.tsx` (`onCursorChange` gate + sensor-sync `useEffect`) — separate concern, working as intended.
- **Placeholder-box visibility rules** — you raised this earlier and the existing `RowView` `isActive` logic already governs it. I will not retouch placeholder UI this turn.

## Verification

After the revert I will:

1. Re-read both files to confirm they match the pre-regression behaviour.
2. Drive Playwright to the smartboard route for this lesson and screenshot the line — expect to see `x = (-b ± √(b² − 4ac)) / 2a` rendered as one continuous structure, matching the lesson note.
3. Confirm the sqrt overline still expands and locked lines still reject clicks.

If the screenshot still doesn't match the lesson note exactly, I stop and ask before making any further change — I will not "improve" the mirror on my own again.
