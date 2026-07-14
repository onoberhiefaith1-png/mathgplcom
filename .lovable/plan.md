# Expandable bar chart / histogram canvas

Right now every bar chart and histogram is locked to a fixed 520 × 340 drawing area (`W` and `H` in `BarChart.tsx`), and the SVG scales down to whatever the container width is. That is why after ~5 bars the bars get too thin — the chart itself can't grow.

Goal: let the teacher expand the chart horizontally and vertically from the settings panel, up to the full width and height of the notebook page, and remove the fixed outer boundary so the chart isn't visually boxed in.

## What the user will see

1. In the right-hand Properties Panel, a new **"Canvas size"** section near the top with:
   - **Width** number input (px) + a slider
   - **Height** number input (px) + a slider
   - **"Fit notebook width"** button — sets width to the current notebook column width
   - **"Reset size"** button — restores the default 520 × 340
2. The chart's outer rectangle border is removed by default (no visible boundary). The notebook page becomes the visual boundary.
3. When the chart is wider than the notebook column, the block scrolls horizontally inside the note so nothing gets clipped.
4. Adding more bars no longer thins them out — bar width stays consistent because the plot area grows with the canvas.

## Technical changes

Files touched: only `smartchart/types.ts` and `smartchart/BarChart.tsx`. No backend or business-logic changes.

**1. `types.ts` — extend `SmartChartAttrs`**
- Add two fields with defaults:
  ```ts
  canvasWidth: number;   // default 520, min 320, max 4000
  canvasHeight: number;  // default 340, min 240, max 3000
  ```
- Normalize + clamp them in `normalizeChart`.

**2. `BarChart.tsx` — use dynamic W/H**
- Replace the module-level constants
  ```ts
  const W = 520; const H = 340;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  ```
  with values derived inside the component from `attrs.canvasWidth` / `attrs.canvasHeight`.
- Pass the same values to the `<svg viewBox>` and to a wrapper `<div style={{ width: attrs.canvasWidth, maxWidth: "100%" }}>`. Wrap in an `overflow-x: auto` container so oversize charts scroll horizontally inside the notebook page instead of being clipped.
- Change the SVG's inline style from `width: "100%"` to `width: attrs.canvasWidth, height: attrs.canvasHeight` so the chart renders at true pixel size (this is what makes bars keep their width as more are added).
- Update the `Legend` helper so it also reads W/H from props (currently it uses the module-level constants). Small refactor: pass `W`, `H`, `PAD` as props.

**3. New "Canvas size" panel section (in the same `editor` JSX)**
```
Canvas size
  Width       [PanelNumber]  (320–4000)
  Height      [PanelNumber]  (240–3000)
  [Fit notebook width] [Reset size]
```
"Fit notebook width" measures the containing notebook column via a ref on the wrapper div (`el.parentElement?.clientWidth`) and writes it into `canvasWidth`.

**4. Remove the default outer boundary**
- Change the default `plotArea.border` behaviour so a chart with `border === "transparent"` and `borderThickness === 0` (the default) draws no outer rectangle. The teacher can still turn a visible border back on from the existing "Graph area" section.
- Also remove the implicit box feel by ensuring the wrapping `<div>` has no border/background of its own.

**5. Bar layout stays as-is**
- `barWidthPct` is still a % of `plotW`, so a wider canvas → wider plot → same visual bar thickness for more bars. The user's earlier rule (bar-chart gap = bar width, histogram gap = 0, leading gap = bar width) is unchanged.

## Out of scope

- Pie / scatter / line / dotplot / boxplot / ogive: not touched in this pass — the user's request was specifically about bar chart & histogram ("all those in that category"). If they want the same resize behaviour on the other chart kinds later, we lift the same two attrs + panel section into a shared helper.
- No changes to the diagram-level Property Panel shell in `living/panel/PropertyPanel.tsx` — that panel is for geometry diagrams, not smart charts. Smart charts already register their editor into the right-hand panel via `useRegisterAssetEditor`.
