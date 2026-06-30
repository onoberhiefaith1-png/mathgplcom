## Fix: Teacher edits on the Floating Number Generation page disappear after Save

### What is happening
On `FloatingNumbersPage`, every save/load runs each filler through `normalizeFloatingLine` (lines 60–81). That helper calls `toUnicodeMath()` then drops any filler for which `isStillDirty()` returns true (anything containing `\frac`, `\sqrt`, `^{`, `_{`, `sqrt(`, `**`, etc.). It also drops empty strings.

Result: the moment a teacher edits a chip to anything that still looks "LaTeX-ish" (or anything `toUnicodeMath` collapses to empty), the manual Save → DB write strips it, and the subsequent reload from DB confirms the deletion. From the teacher's perspective: "I edited it, pressed Save, and my edit disappeared."

This dirty-filter was meant for raw AI output, not teacher-curated chips. Per the existing rule in `floatingCompile.ts` ("Teacher chips are presentation-source-of-truth"), edited chips must be preserved verbatim.

### Fix scope (logic only — no UI changes)

1. **`src/pages/FloatingNumbersPage.tsx` — `normalizeFloatingLine`**
   - Keep every filler the teacher has (do NOT drop on `isStillDirty` or empty).
   - Apply `toUnicodeMath` only as a *display-safety* pass (it never deletes content); if its result is empty but the original string is non-empty, fall back to the original string verbatim.
   - Preserve the parallel `fillersSelected` array 1:1 with no index shifts (no more "keep only kept" filtering, which previously misaligned highlight state).
   - Preserve `arrangement` exactly as saved when filler count is unchanged (which it now always will be).

2. **Persist path (`persist` at line 686)**
   - Already writes `cleanLines`; with #1 fixed, the DB write is now lossless.
   - Add a small post-write self-check: re-read `floating_lines` from the DB after the update; if any line's `fillers` array differs from what we just sent, log a console warning and re-issue the write once. This guarantees parity between what is on screen and what is persisted, which is also what `compileBucket` feeds into the Smartboard.

3. **Compile path (`compileBucket` in `src/lib/lessonnotes/floatingCompile.ts`)**
   - Already preserves teacher-edited fillers; confirm the same `toUnicodeMath`/`isStillDirty` filter inside `compileBucket` is gated by "teacher edited" and does not silently drop edits. If it currently drops, replace with the same "display-safe but never-delete" behavior so the Smartboard bucket matches the saved `floating_lines` row exactly.

### Verification
- Open the Floating Number generation page on the current notebook.
- Edit a chip (e.g. change `5x` to `+5x`, or paste `x²`, or an empty-looking edit).
- Press Save. Reload the page.
- The edited chip text appears exactly as edited, in the same position, with the same highlight state.
- Open the Smartboard for the same notebook — the same edited chip text is what the presentation strip shows.

### Out of scope
No changes to layout, colors, the rotating-conveyor logic, the AI assistant, or the FloatingPreparationPage. This is a Save/Load fidelity fix only.