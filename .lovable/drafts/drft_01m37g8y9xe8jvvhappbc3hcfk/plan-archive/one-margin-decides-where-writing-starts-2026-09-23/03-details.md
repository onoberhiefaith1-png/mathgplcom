## Technical detail

1. **Content margin as saved layout data**
   - Add `contentMargin` (fraction of the writing band, clamped) to the Game's saved surface layout in `slate_games.settings`, one value per scroll — not per text object.
   - Normalize and default it beside the existing text configuration in `src/lib/slate/textConfig.ts`; no change to `SlotTextConfig` placement fields.

2. **Fixed left edge, content-driven right edge**
   - Replace the centre-anchored surface geometry in `src/lib/slate/layout.ts` (`surfaceInnerBox`, `gameSurfaceBox`) with a left-anchored box: `left = band.left`, `right = left + max(minWidth, margin + measuredTextWidth + visualInsets.right + padX)`.
   - Content region excludes the scroll's decorative fold: add per-surface fold insets in `src/lib/slate/surfaces.ts` and subtract them before the content box is computed. Text bounds are clamped to the content region only.

3. **One deterministic layout pass**
   - Text X becomes `contentLeft + margin`; alignment operates inside the content width only. Remove the per-frame corrective guard loop in `WritingRegion.tsx` as the routine mechanism.
   - Re-measure only when a real input changes: text, font metrics, appearance key, margin, band width. Compare with the existing tolerance and stop — no springs, no interpolation, no repeated correction.
   - Keep `resolveSurfaceTextPlacement` as a validation safety net and keep the **Text** icon as a manual fit; neither runs continuously.

4. **Handle interaction**
   - Small draggable handle rendered at the top of each scroll (editor and runtime), with keyboard nudge and an invisible dashed guide shown only while dragging.
   - Teacher drag writes the scroll's `contentMargin` on save. Student drag writes a per-student value and never touches the teacher record.

5. **Per-student margin storage**
   - Stage an additive migration under this draft's migrations folder adding a per-student surface preference row (user + game + margin) with RLS limited to the owning user, plus the required grants. It applies when the draft is accepted, so the student-saved margin cannot be exercised in the draft preview.

6. **Text settings unchanged**
   - Size, depth, front/depth colour, shadow, glow and effects continue to drive the renderers. After any change: recalculate bounds → check content region → grow/reflow → keep margin alignment. Never silently reduce the chosen size.

## Verification

- Unit tests: left edge fixed while margin moves; right edge grows only when `margin + text + padding` exceeds current width and contracts when it does not; text never enters fold insets; repeated measurement is idempotent.
- Browser checks on the affected Game with `2(x + 3) − 4x = 8`: drag margin both ways, change size/depth/colour/shadow, then save, reopen, preview, play, test, reload and resize — confirming no trembling and no writing on the fold.
