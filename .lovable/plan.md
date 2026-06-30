## Goal

Make the two sliders in **Board Settings** actually do what their labels say, in the way you described in the voice note.

- **Lesson Line Spacing** → grows only the vertical gap *between* lesson lines (between the "quadratic equation" paragraph and the "quadratic formula" paragraph, between the formula and the `x = …` equation, etc.). Inside one lesson line nothing moves — `2a` stays welded under the fraction bar of the quadratic formula.
- **Text Size** → grows the actual lesson content (prose, equations, fractions, roots, exponents, variables, `2a`, `±`) proportionally, while page width, margins, top bar, settings panel and the smartboard chrome stay exactly the same.

Right now the wiring is incomplete:

- `grid.FONT_PX` is only piped into `BoxLayer` (the floating answer chips). The lesson canvas (`FreeWriteLayer` → `MathTreeRender`) has no `fontSize` and just inherits a fixed body size, so the Text Size slider visually does nothing to the equations.
- `lineSpacing` is multiplied straight into `LINE_HEIGHT`, which is *also* what positions every internal structure (smart-line overlay, band math, panel anchors). Moving it shifts a lot of things at once, which is why the slider feels like it's resizing the whole "section" rather than just opening up the gap between two lesson lines.

## What changes

### 1. Text Size becomes real

`src/components/smartboard/FreeWriteLayer.tsx`

- Read `grid.FONT_PX` and apply it as `fontSize` on each `LineRender`'s wrapping `<div>`. Because every math sub-structure inside `MathTreeRender` is sized in `em` (fractions, sqrt overlines, exponents, brackets, `2a` denominator, etc.), bumping the parent font scales the entire equation as one rigid unit.
- Adjust `lineHeight` to `1` (the surrounding row height is still controlled by `grid.LINE_HEIGHT`, so we don't double-stretch).

`src/components/smartboard/PresentationView.tsx`

- No prop changes; `grid` is already memoised from `getGrid(zoom, lineSpacing, textScale)`. Verify the canvas wrapper does not pin a fixed `fontSize` that would shadow `FreeWriteLayer`.

Result: dragging Text Size from 70%→180% smoothly grows every lesson line's text and math together. Page chrome, margins, sliders, settings panel and toolbars are untouched because none of them read `FONT_PX`.

### 2. Lesson Line Spacing becomes "gap only"

`src/lib/smartboard/grid.ts`

- Split `LINE_HEIGHT` into two parts:
  - an **intrinsic row height** derived from `FONT_PX` so text never overlaps when Text Size grows (`intrinsic = FONT_PX * 1.85`);
  - an **extra gap** controlled by the slider (`extraGap = (lineSpacing − 1) * BASE_EXTRA_GAP`, where `BASE_EXTRA_GAP ≈ 28 px`).
- `LINE_HEIGHT = intrinsic + extraGap`. At `lineSpacing = 1` we keep the current default visual; below 1 the gap closes; above 1 it opens up — but the intrinsic row never collapses, so multi-line math (fractions, sqrt) never clips.
- Keep `BASELINE_OFFSET`, `MARGIN_LEFT`, `MARGIN_TOP` unchanged.
- Keep `clampLineSpacing` and `clampTextScale`. Remove the now-unused `LINE_SPACING_PRESETS` / `TEXT_SIZE_PRESETS` exports (already not rendered).

Because each lesson line is one absolute-positioned `LineRender` placed at `MARGIN_TOP + line * LINE_HEIGHT`, increasing only the gap moves the *next* lesson line down without touching the contents of the current one. The internal layout of the quadratic formula (numerator, fraction bar, `2a` denominator) is sized in `em` inside `MathTreeRender` and never reads `LINE_HEIGHT`, so it stays welded together exactly as you described.

### 3. Notes

- Smart-line overlay, box detach threshold, sensor magnet and panel anchors all already key off `grid.LINE_HEIGHT`, so they continue to move in sympathy with the new spacing — no separate fixes needed.
- Persistence (`smartboard:lineSpacing:*`, `smartboard:textScale:*`) is already in place.
- No backend changes, no schema changes, no UI redesign — only the two sliders behave the way the voice note describes.

## Files touched

- `src/lib/smartboard/grid.ts` — split intrinsic row height vs slider gap.
- `src/components/smartboard/FreeWriteLayer.tsx` — apply `grid.FONT_PX` as `fontSize` per line.
- `src/components/smartboard/PresentationView.tsx` — sanity check that no parent `fontSize` overrides the new value (read-only verification, edit only if a shadowing rule is found).
