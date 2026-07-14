## Goal
Replace the 8 static chart SVGs (bar, pie, histogram, scatter, line, dot plot, box plot, ogive) with **one interactive Smart Chart asset**. All editing happens in the right-hand Properties Panel (per the universal-editing rule) plus drag handles on the chart itself. Every default is **blank** — teachers add their own data.

## Architecture

Create a new node/family `smartChart` — parallel to Smart Table, Smart Graph, arithmetic assets — instead of extending the current `chart` visual (which renders static SVG from a CSV string). The current `chart` family stays as legacy so old documents keep rendering; the palette entries in `src/lib/lessonnotes/assets/graphs.ts` swap to `smartChart`.

```
src/components/lessonnotes/extensions/
  SmartChart.tsx                    # TipTap node + attrs schema
  visuals/smartchart/
    SmartChartView.tsx              # NodeView, registers Properties Panel editor
    types.ts                        # ChartKind, Row, Point, ChartAttrs
    scale.ts                        # auto/manual axis scaling, nice-ticks
    Axes.tsx                        # shared axis + gridlines renderer
    charts/
      BarChart.tsx
      PieChart.tsx
      Histogram.tsx
      ScatterPlot.tsx
      LineGraph.tsx
      DotPlot.tsx
      BoxPlot.tsx
      Ogive.tsx
    editor/
      SmartChartEditor.tsx          # right-hand panel router by kind
      panels/BarPanel.tsx  …        # one panel per chart kind
      shared/DataTable.tsx          # add/delete/edit rows
      shared/AppearanceFields.tsx
      shared/AxesFields.tsx
      shared/UniversalTools.tsx     # duplicate/reset/clear/import/export/animate/lock/presentation
```

Wire the node in the existing extensions list (same place `SmartTable`, `SmartGraph`, arithmetic nodes are registered) and add the palette entry.

## Data model (node attrs)

```ts
type ChartKind =
  | "bar" | "pie" | "histogram" | "scatter"
  | "line" | "dotplot" | "boxplot" | "ogive";

interface SmartChartAttrs {
  kind: ChartKind;
  title?: string;
  // shared appearance
  palette: string[];              // per-item colours
  strokeWidth: number;
  gridlines: boolean;
  animateOnChange: boolean;
  locked: boolean;                // classroom "lock editing"
  presentation: boolean;          // hides handles/panel affordances
  showAnswers: boolean;
  // shared axes
  xLabel: string; yLabel: string;
  showAxisLabels: boolean; showTicks: boolean;
  yAuto: boolean; yMin: number | null; yMax: number | null;
  // per-kind payload — only the relevant one is used
  bar?:       { rows: {label:string; value:number; color?:string; width?:number}[];
                equalWidth: boolean; gap: number; showValuesAbove: boolean };
  pie?:       { sectors: {name:string; value:number; color?:string}[];
                labelPos: "inside"|"outside"|"none"; showPercent: boolean; showAngle: boolean };
  histogram?: { intervals: {lower:number; upper:number; frequency:number}[];
                useDensity: boolean; continuous: boolean; gap: number };
  scatter?:   { points: {x:number; y:number}[];
                shape: "circle"|"square"|"triangle"|"cross";
                size: number; bestFit: "none"|"linear"|"quadratic";
                showEquation: boolean; showCorrelation: boolean };
  line?:      { points: {label:string; value:number}[];
                connect: "straight"|"smooth"|"none"; markerShape:string; markerSize:number };
  dotplot?:   { values: number[]; dotSize: number; shape:"circle"|"square"|"cross" };
  boxplot?:   { min:number; q1:number; median:number; q3:number; max:number;
                outliers: number[]; showMean: boolean; mean?:number;
                orientation:"horizontal"|"vertical"; showLabels:boolean };
  ogive?:     { rows: {boundary:number; cumFreq:number}[];
                curve:"smooth"|"straight"; markerShape:string; markerSize:number };
}
```

Defaults: `kind` picked from palette; the matching payload starts **empty** (no rows/points/sectors). Every chart renders blank axes/circle until data is added.

## Properties Panel

Uses the existing `useRegisterAssetEditor` slot. `SmartChartEditor` reads `kind` and mounts the right panel. Sections in each panel follow the prompt exactly:

- **Data** — chart-specific: add/delete row, inline label + value inputs, plus the special inputs per kind (percent/angle for pie, boundaries + freq/density for histogram, x/y for scatter, five-number summary for box, cumulative freq for ogive). Pie panel auto-recomputes value/percent/angle when one is edited (system fills the rest).
- **Appearance** — palette per item, border thickness, bar/marker/dot size, gap, "Continuous bars" for histogram, gridlines on/off.
- **Axes** — x/y labels, show axis labels, show ticks, show values above bars, auto-scale toggle, manual min/max.
- **Analysis** (scatter only) — best-fit line/curve, correlation display, equation display; computed via least-squares in `scale.ts` helpers.
- **Universal Tools** (all kinds) — duplicate, reset (defaults), clear data, import CSV (paste box), export CSV (download), animate construction toggle, show/hide answers, lock editing, presentation mode.

All edits patch node attrs through TipTap so undo/redo works. `showAnswers=false` hides values on axis/data labels but not the shape.

## Drag editing on the chart

Only when `!locked && !presentation`. SVG overlays absolute-positioned handles bound to attrs:
- Bar chart: vertical handle at the top of each bar → drag updates `rows[i].value`.
- Line/Ogive: draggable point markers → update `value` (line) or `cumFreq` (ogive).
- Scatter: draggable points → update `x, y` in current axis units.
- Pie: draggable sector boundary arcs → adjust the two adjacent sector values, preserving their sum so other sectors stay put.
- Box plot: five draggable handles (min, Q1, median, Q3, max) → clamp order (min ≤ Q1 ≤ median ≤ Q3 ≤ max).
- Histogram: top edge of each bar → frequency (or density if that mode is on).
- Dot plot: click adds a value; drag a stack column horizontally to move that value.

Dragging goes through the same attr-patch pipeline as the panel, so hover highlighting, undo, and auto-scale (when `yAuto`) work.

## Auto-scaling

`scale.ts` computes a "nice" domain (Wilkinson-style: multiples of 1/2/5 × 10ⁿ) from the current data when `yAuto` is true; otherwise uses `yMin`/`yMax`. Runs on every render — no manual redraw. Manual scale simply overrides.

## Palette wiring

`src/lib/lessonnotes/assets/graphs.ts`: keep the eight entries, change `render.kind` from the current `visual`/`chart` to the new `smartChart` node, with `attrs: { kind: "bar" }` etc. Legacy documents that still hold the old `chart` visual continue to render via `visualDispatch` unchanged.

## Phasing (so the change lands safely)

1. **Scaffolding + Bar Chart end-to-end** — new node, editor slot, data/appearance/axes panels, drag handles, auto-scale, universal tools. Bar palette entry switched over. Validates the whole architecture.
2. **Pie + Line + Dot Plot** — reuse `DataTable` and axis code.
3. **Histogram + Scatter (with best-fit) + Box Plot + Ogive** — the more analytical panels.
4. **Animate construction toggle** — staggered entry animation on `animateOnChange` and on first mount when enabled.

I'll pause after phase 1 so you can confirm the interaction feels right on the bar chart before I roll it out to the remaining seven.

## Out of scope

- LongDivision / DivisionLadder / BaseConversion (already interactive).
- Smart Graph and Smart Coordinate Plane (already interactive teaching assets).
- No AI-driven chart generation — teacher-editable only.
- No changes to the existing `chart` visual family; kept for backward compatibility with old notebooks.
