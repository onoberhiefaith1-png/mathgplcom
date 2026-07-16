# Histogram = Bar Chart gateway

The Bar Chart component already supports Histogram mode via `displayMode: "histogram"`, and the settings panel can switch between the two. The Histogram asset should just be a "gateway" into that same component with the histogram switch flipped on — nothing more.

Right now Histogram diverges from Bar Chart in one place, which causes the "too wide / resize doesn't work" bugs you reported.

## What's wrong today

In `BarChart.tsx`, histograms use a special code path:

- Bar width is forced to `plotW / nBars` (stretch every bar edge-to-edge across the plot).
- Gap between bars is forced to `0`.
- The `barWidthMode` selector (Thin / Normal / Wide) is ignored for histograms.

That's why the default histogram looks too wide and the width selector does nothing.

## The fix (single, small change)

Treat histogram exactly like bar chart, with **one** difference: **the bars touch** (no gap between adjacent bars). Everything else — slot sizing, `barWidthMode`, spacing rhythm, labels, axes, editor panel — is the shared Bar Chart code.

Concretely, in `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx`:

1. Remove the special `histBarWidth = plotW / nBars` stretch.
2. Use the same `barWidth` calculation as bar chart, including `barWidthMode` (thin / normal / wide / auto).
3. For histogram, keep the "bars attached" property by removing the inter-bar gap only:
   - `xForBar(i)` places bars adjacent: `PAD.left + i * barWidth` (no gap slot).
   - `slotSvg` for histogram becomes just `barWidth` (one slot per bar, no gap slot).
4. Keep `baseSlotCount` logic so a chart with few bars still fills the notebook column, just like bar chart.

No changes to:

- `types.ts` (data model already shared).
- `SmartChart.tsx` (already dispatches both kinds to `BarChart`).
- `graphs.ts` asset registry (Histogram entry already routes to `smartChart` with `kind: "histogram"`, which is exactly the gateway you described).
- The Properties Panel editor (already the same panel; the Bar/Histogram switch inside it already works).

## Result

- Clicking the **Histogram** asset opens the Bar Chart component with the Histogram switch pre-selected — same component, same settings panel, just named/pre-configured as Histogram.
- Clicking **Bar chart** opens the same component with the Bar switch pre-selected.
- You can still swap between Bar ↔ Histogram from the settings panel (this already works and is preserved).
- Default histogram width is now normal (not stretched), and Thin / Normal / Wide work identically to bar chart.
- The only visual distinction between the two modes is: histogram bars touch, bar chart bars have a gap.

## Files to edit

- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — remove histogram-specific stretching in the geometry block (lines ~61–92) and let histogram reuse the bar-chart width math with `gap = 0`.
