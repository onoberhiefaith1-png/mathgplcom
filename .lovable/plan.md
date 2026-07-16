## Goal

When a teacher inserts a Bar Chart, Histogram, Line Graph, or Scatter Plot, the section becomes **graph paper**, not a small embedded widget. The graph fills the full writable width of the notebook, starts at ~20 cm tall, and can be extended upward without resizing anything that already exists on it.

## 1. Full-width graph paper

Currently `BarChart.tsx` uses a fixed `targetPlotW = 640` and `min slotSvg` so a chart with few bars occupies only a fraction of the column.

Change:
- Remove the "target 640 svg-unit" heuristic. The SVG uses `width: 100%` of the notebook column and its viewBox becomes `PAD.left + plotW + PAD.right` where `plotW` is chosen so the SVG naturally fills the column.
- The wrapper `<div>` (currently narrow when zoom = 1) becomes `width: 100%` at zoom 1, growing only when zoom > 1 (horizontal scroll on overflow, which is fine — that's the existing scroll container).
- Bar slots (`slotSvg`) are sized so `n_slots * slotSvg = plotW`. This gives responsive auto-width bars: 2 bars = wide bars, 40 bars = thin bars, arbitrary count, mathematically consistent with graph paper.
- Histogram and Line use the same "fill the column" rule (line uses N-1 slots between plotted x positions; scatter uses the whole plotW as its numeric x-range).

Same rule applies to LineChart, Histogram (already shares BarChart with `displayMode`), and ScatterPlot.

## 2. Initial height = ~20 cm

`normalizeChart` in `types.ts` defaults `axisMaxCm` to 7. Change the default (only for **new** graphs — a graph is "new" if `axisMaxCm` isn't present in the stored attrs) to **20**. Existing graphs keep whatever height they were saved at.

## 3. Extend adds paper at the TOP (no resize)

Current `extendY` sets `axisMaxCm += 1`. Because `cmToY(cm) = PAD.top + (axisMaxCm - cm) * CM_PX`, incrementing `axisMaxCm` already keeps bar heights (in cm) fixed in place — the y=0 baseline stays put, and a new empty row appears at the top. This is the desired mathematical behaviour.

What we need to add:
- A larger, clearly labelled **+ Extend** control (see §5) that steps by 1 cm.
- Optional: hold Shift to add 5 cm.
- The SVG viewBox height grows by `CM_PX`; the notebook page grows with it (the chart's wrapper is `height: auto`, so this already flows naturally).

Nothing else changes on Extend: bars, labels, scale, zoom stay identical.

## 4. Zoom stays visual only

Zoom already applies as `width: ${100 * zoom}%` on the wrapper. Keep that behaviour verbatim. Rename tooltip copy so it's clear Zoom ≠ Extend: "Zoom (visual only — does not add graph paper)".

## 5. Redesigned Scale / Extend chip

The current pill at the top-left is small (`text-[11px]`, thin border, low-contrast primary text on background). Replace with a clearly readable control:

- Chip height 32 px, dark border, solid background matching the notebook paper, bold text: **1 cm = [ 5 ] units** with a proper `<input type="number">` inside the chip (not hidden behind a popover) — the number is always visible and editable in place.
- Input: 56 px wide, 14 px font, `text-foreground` (dark), `bg-background`, 2 px border `border-foreground/40`, focus ring in `--primary`. Works legibly on both light and dark themes because it uses semantic tokens.
- Right of the scale chip: an equally prominent **+ Extend** button (32 px height, same visual weight, with an up-arrow icon and the word "Extend"). Tooltip: "Add 1 cm of graph paper at the top".
- Small "−" shrink button remains but is de-emphasised (icon-only, muted).
- The Zoom pill row keeps its current placement in the Advanced panel and gets a "visual only" hint.

## 6. Scope

- `BarChart.tsx` (covers `kind: "bar"` and `kind: "histogram"` via `displayMode`)
- `LineChart.tsx` — same full-width rule, same 20 cm default, same Extend/scale chip
- `ScatterPlot.tsx` (if present as a separate file, else through the same shared canvas) — full-width, same chip. Scatter's y-axis extend semantics are identical (add cm at the top).
- `types.ts` — default `axisMaxCm` to 20 for new attrs only.

Pie / dotplot / boxplot / ogive are unaffected (they aren't graph-paper charts).

## Technical details

**Files to touch**

1. `src/components/lessonnotes/extensions/visuals/smartchart/types.ts`
   - In `normalizeChart`, change `Math.round(num(a.axisMaxCm, 7))` → `Math.round(num(a.axisMaxCm, 20))`. Legacy notebooks keep their saved value.
   - Bump `axisMaxCm` clamp upper bound from 30 → 60 (large classroom problems).

2. `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx`
   - Delete `targetPlotW = 640` and the `Math.max(min, targetPlotW / baseSlotCount)` clamp. Replace with a container-measured width: use a `ResizeObserver` on the outer wrapper to read its px width, convert to svg units via `slotSvg = availablePx / baseSlotCount` (with a floor of ~18 svg-units so bars stay tap-able; below the floor, allow horizontal scroll).
   - Alternative simpler approach (preferred): keep an SVG-space `plotW` but set it via `slotSvg = Math.max(24, Math.min(80, columnPx / baseSlotCount * (SVG_UNITS_PER_PX)))`. Because the SVG is `width: 100%`, choosing `plotW` proportional to `baseSlotCount` inside a fixed viewBox range gives the correct visual outcome regardless of column width — bars auto-thin as count grows and fill the paper.
   - Replace the current scale/Extend overlay HTML (lines ~635–697) with the redesigned chip described in §5. Use semantic tokens (`bg-background`, `text-foreground`, `border-foreground/40`, `focus:ring-primary`) — no hard-coded colours.
   - Extend button uses `Math.min(60, axisMaxCm + (shiftKey ? 5 : 1))`.

3. `src/components/lessonnotes/extensions/visuals/smartchart/LineChart.tsx`
   - Same full-width rule and same redesigned Extend/Scale chip.
   - Same 20 cm default flows from `normalizeChart`.

4. `src/components/lessonnotes/extensions/visuals/smartchart/ScatterPlot.tsx` (if it exists — otherwise it goes through the same host)
   - Same treatment.

5. `.lovable/plan.md` — record the "graph becomes the page" model.

**Guarantees checked before finishing**

- Extend does not change any bar's `heightCm`, `unitsPerCm`, or `zoom`. Verified by property test in the diff: patch = `{ axisMaxCm: axisMaxCm + n }` only.
- Zoom does not change `axisMaxCm`, `unitsPerCm`, `heightCm`, or the SVG viewBox — only the wrapper `width`.
- New default of 20 cm applies **only** to freshly inserted charts. Existing notebooks with stored `axisMaxCm` continue rendering at their saved height.

## Out of scope (won't change in this pass)

- The visual notebook margins themselves — the graph respects the same column the notebook editor already gives it.
- Backend / persisted schema — `axisMaxCm` already exists and is stored.
- Any other chart kind (pie, dotplot, boxplot, ogive).
