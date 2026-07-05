## Rebuild the placeholder from scratch in `MathTreeRender.tsx`

### Why the current approach didn't blend

The board isn't a flat color — `#sb-root` layers a noise texture and subtle gradients over `palette.background`. A dashed cube painted with a flat `--placeholder-ink` (equal to `palette.background`) sits **under** those overlays on the writing layer, so the eye still sees a slightly off-tone rectangle. No amount of color-matching to `palette.background` will match the textured surface pixel-for-pixel. The only way to truly blend is to **paint nothing at all** on the board — while still keeping the slot structural, sized, and tappable.

### Plan

1. **Delete** the current empty-sub-row branch in `RowView` (`src/components/smartboard/MathTreeRender.tsx`, roughly lines 96–135 — the dashed-cube render that uses `--placeholder-ink`). Remove the `placeholderColor` local and all border/background/color styling tied to it.

2. **Rebuild** the empty-sub-row branch with a two-mode rule driven by a React context (`PlaceholderMode = "visible" | "blend"`):

   - **`"visible"` (default — Floating Number panel, Present preview, lesson-note generation, everywhere except the live smartboard writing surface):** render exactly today's full-strength black dashed cube. Same dimensions, same dashed border, same fill, same tap target, same active-focus glow driven by `caretColor`. No visual change on these surfaces.
   - **`"blend"` (smartboard writing surface only):** render an **invisible** slot — no border, no background, no glyph. Just an inline-flex span of the same intrinsic size (`min-width: 0.7em; min-height: 0.85em; margin: 0 1px`) with the pointer-down handler that focuses the slot. Structurally identical to the visible mode so `2a`, exponents, fraction bars, radicals still lay out correctly. When the slot is *active*, keep a soft `caretColor` glow (dashed border + `${caretColor}1f` fill + box-shadow) so the teacher can see where the caret sits — only the *idle* placeholder is fully invisible.

3. **Wire the context provider:**
   - Create a tiny module `src/components/smartboard/placeholderMode.tsx` exporting the context, provider, and a `usePlaceholderMode()` hook. Default value: `"visible"`.
   - In `PresentationView.tsx`, wrap the `FreeWriteLayer` render (inside `#sb-root`'s writing area) with `<PlaceholderModeProvider value="blend">`. Everything outside this wrapper — the Floating Number panel, the Present-preview panel that sits alongside the board, the lesson-note generation page — remains in the default `"visible"` mode.
   - Remove the now-unused `--placeholder-ink` CSS variable and the `placeholderInk` fields from `palette` in `PresentationView.tsx` (whiteboard/blackboard entries) since the new approach doesn't need a color token at all.

4. **Active-slot exception is preserved:** the `isActive` branch still renders the caret + soft glow in both modes, so the teacher never loses sight of where the sensor is parked.

### Files touched

- `src/components/smartboard/MathTreeRender.tsx` — delete + rewrite the empty-sub-row branch; read `usePlaceholderMode()`; two render paths.
- `src/components/smartboard/placeholderMode.tsx` — new file, context + provider + hook.
- `src/components/smartboard/PresentationView.tsx` — wrap the board's `FreeWriteLayer` subtree in `<PlaceholderModeProvider value="blend">`; drop the `placeholderInk` palette fields and the `--placeholder-ink` inline-style entry on `#sb-root`.

Nothing else changes. No structural rewrite of fractions/roots/powers. No cursor/focus logic touched.

### Verification (after implementing, please regenerate the equation and test)

1. Board on default (black) theme → build a fraction: numerator and denominator empty slots are completely invisible, but the bar renders, layout is stable, and tapping either slot places the caret with a visible glow.
2. Switch board to white → same fraction's empty slots stay invisible against the white surface (no leftover tinted rectangle from a flat color).
3. Switch to yellow → still invisible.
4. Open the Floating Number panel and the Present preview panel → container chips (`□/□`, `√□`, `□²`) render as today's full-strength black dashed cubes, fully visible.
5. Lesson-note generation page → placeholders render as today's black cubes.
6. Tap an empty slot on the board → focus glow appears; type a digit → glow disappears, digit replaces the slot; delete → invisible placeholder returns.
