## Goal

Turn the Bar Chart into a true mathematics graph constructor, and make Histogram share the same engine — differing only in whether bars touch. The teacher never draws bars; they define scale, categories, and values, and the software plots.

## Scope

- Rewrite `smartchart/BarChart.tsx` as a **mathematical bar/histogram renderer**.
- Extend `smartchart/types.ts` with the extra attrs the panel needs (minor divisions, display mode, axis styling, tick/grid/label controls, data-label position, examination mode, presets).
- Extend `smartchart/scale.ts` with a minor-division helper.
- Wire `histogram` chart kind in `SmartChart.tsx` to the same renderer with `displayMode: "histogram"` so gap is forced to 0.
- Everything drives from the right-hand Properties Panel via `useRegisterAssetEditor` (per Universal editing rule). Nothing on-canvas draws bars.

Out of scope: pie/scatter/box/line/dotplot/ogive (still placeholders), backend, AI, other visuals.

## Data model (types.ts additions)

Add to `SmartChartAttrs`:

```text
displayMode: "bar" | "histogram"
yMinorDivisions: number          // subdivisions per major interval, default 5
xAxis / yAxis:  { show, arrow, thickness, color, title }   // title already exists
grid:           { showMajor, showMinor, color, thickness }
ticks:          { show, length, thickness }
numbers:        { show, fontSize, decimals, side: "left" | "right" }
dataLabels:     { show, position: "above" | "inside" | "below" }
barStyle:       { borderColor, borderThickness, opacity, uniformColor: string | null }
fonts:          { family, size, bold, italic }             // axis/category/scale/labels
legend:         { show, position: "top" | "bottom" | "left" | "right" }
plotArea:       { background, border, borderThickness, padding }
examMode:       { hideValues, hideCategoryLabels, hideAxisTitles, blank }
preset:         "custom" | "waec" | "neco" | "gcse" | "alevel"
```

`bar.rows` stays `{ label, value, color?, width?, showLabel? }`. `equalWidth`, `gap`, `barWidth`, `showValuesAbove` remain (showValuesAbove replaced by `dataLabels.show`, kept for back-compat and migrated on load).

All new fields are optional with sane defaults resolved at render, so existing documents keep working.

## Renderer (BarChart.tsx)

- **Scale-first**: Y-axis uses `resolveYScale(values, yAuto, yMin, yMax, yStep)` for majors, and a new `minorTicks(scale, yMinorDivisions)` helper adds sub-grid lines between majors. Bar heights come from `yToPx(value) − yToPx(baseline)` where baseline = clamped 0.
- **Categories drive X**: X positions come from `bar.rows[i].label`. No dragging bars on canvas (drag handle removed — teacher edits values in the panel). Cursor over a bar just highlights it.
- **Histogram vs bar**: when `displayMode === "histogram"` (or chart kind is `histogram`), gap is forced to 0 and border collapses between adjacent bars. Otherwise `bar.gap` applies. Same code path.
- Axis, tick, grid, number, data-label, legend, and plot-area rendering all read from the new attrs. Fonts applied via inline `style` on SVG text.
- Exam mode hides values/labels/titles per its flags; `blank` hides everything except axes and scale.
- Presets (WAEC/NECO/GCSE/A-Level/Custom) are one-click attr bundles applied through a small `applyPreset(name)` helper — they set gridlines, fonts, colours, tick style, number style. Custom = no-op.

## Properties Panel layout

Rewritten in section order matching the request, one `PanelGroup` per section:

1. Scale — auto/manual toggle, min, max, major interval, minor divisions
2. Axes — Y and X sub-blocks: title, show, arrow, thickness, colour
3. Categories (X-Axis) — add / rename / reorder (↑ ↓) / delete
4. Bars — per-row: category (dropdown of categories), value, width, colour, border colour, border thickness, label, show-label, remove; buttons: Add Bar, Duplicate, Delete
5. Bar Layout — width, gap, equal width, automatic width
6. Display Mode — Bar Chart / Histogram (radio)
7. Grid — show/hide, major, minor, colour, thickness
8. Tick Marks — show, length, thickness
9. Numbers — show, font size, decimals, side
10. Data Labels — show, position (above / inside / below)
11. Colours — uniform vs individual, opacity, border colour, border thickness
12. Fonts — family, size, bold, italic
13. Legend — show, position
14. Graph Area — background, border, thickness, padding
15. Examination Mode — hide values, hide labels, hide axis titles, blank
16. Presets — WAEC / NECO / GCSE / A-Level / Custom
17. Universal Tools — existing CSV import/export, reset, presentation, lock, answers, duplicate (from `UniversalTools.tsx`, unchanged)

Categories and Bars are decoupled in UI but stored in one array: adding a category creates a bar with value 0; the "Bars" section edits the value/style of the same row. This mirrors the mental model in the request while keeping the data model simple.

## Files to change

- `src/components/lessonnotes/extensions/visuals/smartchart/types.ts` — extend `SmartChartAttrs` with new optional fields + defaults helper
- `src/components/lessonnotes/extensions/visuals/smartchart/scale.ts` — add `minorTicks(scale, divisions)` helper
- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — rewrite render + panel per above
- `src/components/lessonnotes/extensions/visuals/smartchart/SmartChart.tsx` — route `kind === "histogram"` to the bar renderer with `displayMode: "histogram"` (remove histogram placeholder)
- `src/components/lessonnotes/extensions/visuals/smartchart/UniversalTools.tsx` — no change (reused)
- `.lovable/plan.md` — record the phase

No changes to `LivingDiagram.tsx`, `graphs.ts`, tests, or backend.

## Migration / back-compat

- Missing new attrs resolved via a `withDefaults(attrs)` function inside `BarChart.tsx` before render — old documents load unchanged.
- `bar.showValuesAbove` maps to `dataLabels.show` on first render if `dataLabels` is absent.

## Verification

- Add a Bar Chart from the palette: panel shows the 17 sections in the listed order; scale controls set 0/20/5/5 and Y-axis renders `0,5,10,15,20` with 4 minor gridlines between each pair.
- Add categories A–E, set values 4,7,10,6,8 — bars plot at correct heights without dragging.
- Toggle Display Mode → Histogram: gaps collapse, bars touch, everything else identical.
- Toggle Exam Mode → blank: values, category labels, and axis titles disappear; scale and axes remain.
- Apply WAEC preset: font/gridlines/tick style switch in one click.
