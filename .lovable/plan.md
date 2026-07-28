## What's wrong today

Verified in `src/lib/smartboard/grid.ts`: all three values feed one formula.

```text
fontPx     = 34 * zoom * textScale
naturalRow = fontPx * 1.16
lineHeight = naturalRow + rowSpacing * 44 * zoom
```

So `textScale` multiplies both font AND row pitch — identical in effect to `zoom`. And `rowSpacing` is a 0–100% continuous "extra pixels" slider, not a multiple of cursor height. That is exactly the duplication reported.

## Target model

Three independent quantities:

```text
CURSOR_H  = 34 * 1.16 * zoom          // one cursor height, zoom-only
FONT_PX   = 34 * zoom * textScale     // ink size only
ROW_PITCH = CURSOR_H * rowSpacing     // rowSpacing ∈ {1,2,3,4,...}
```

- **Zoom** — unchanged behaviour, scales the whole board (page, margins already stay fixed by design).
- **Text Size** — changes `FONT_PX` only. Row pitch is untouched.
- **Row Spacing** — integer multiplier of cursor height between writable rows. Nothing else.

## Text grows downward

The board already positions rows at a uniform pitch and reserves extra rows for tall objects via `extraRowsFor` in `PresentationView.tsx` (fraction/matrix/big-operator → +1 row). Text Size will hook into the same law instead of inflating the pitch:

- Rows keep their top edge fixed; ink is baseline-anchored downward from the row top.
- A row whose measured height (already tracked in `lineHeightsRef` via `handleLineMeasure`) exceeds its allotted `ROW_PITCH` reserves `ceil(measured / ROW_PITCH) - 1` extra rows, so the following content moves down. Shrinking the text releases those rows and content moves back up.
- This replaces the fixed `return 1` in `extraRowsFor` with `max(tallStructureRows, measuredOverflowRows)` — the structural law is preserved as a floor, so fractions never regress.

## Changes

1. `src/lib/smartboard/grid.ts`
   - `getGrid(zoom, rowSpacing, textScale)`: `CURSOR_H = BASE_FONT_PX * MIN_ROW_PER_FONT * zoom`; `LINE_HEIGHT = CURSOR_H * clampRowSpacing(rowSpacing)`; `FONT_PX = BASE_FONT_PX * zoom * textScale`.
   - `clampRowSpacing` becomes integer clamp 1..6 (was 0..1 fractional). Export `CURSOR_HEIGHT` on the Grid object for callers.
   - Keep `clampTextScale` (0.7..1.8).
2. `src/components/smartboard/PresentationView.tsx`
   - Default `rowSpacing` state 1 (not 0); migrate old stored fractional values (`< 1` → 1) when reading `smartboard:rowSpacingV1:*`.
   - `extraRowsFor`: add measured-height overflow term described above.
   - Caret height uses `CURSOR_H` (zoom only) so the cursor stays a stable row unit while text scales.
3. `src/components/smartboard/SettingsSheet.tsx`
   - Row Spacing control becomes a stepped integer control (1×, 2×, 3×, 4×) labelled in cursor heights, with updated helper text.
   - Text Size keeps its 70–180% slider, helper text corrected to "does not change row spacing".
4. `src/components/smartboard/MoreMenu.tsx`
   - Rename "Workspace Zoom" / "Zoom Controls" to a single **Zoom** entry (behaviour untouched) so there is one clearly-named zoom control.
5. Tests — extend `src/test/sensorSpacing.test.ts` (or a new `gridIndependence.test.ts`) to assert: changing `textScale` does not change `LINE_HEIGHT`; changing `rowSpacing` does not change `FONT_PX`; `rowSpacing = n` gives exactly `n × CURSOR_H`.

## Notes

- Row Spacing is global to the Smartboard grid, so it applies uniformly to Introduction, Examples, Solutions, Classwork, Homework and Assessment bands automatically — they all read the same `grid`.
- Fractions/roots/powers keep their intrinsic rendered height; only the gap between writable rows is governed by Row Spacing.
