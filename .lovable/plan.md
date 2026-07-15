
# Graph Editor Redesign — Fixed Paper, Direct Editing

Rebuild the bar chart, histogram, and line chart around a clear mathematical model. Everyday editing happens **on the graph itself**; the properties panel becomes secondary (collapsed under "Advanced").

## 1. The Mathematical Model

Three independent concepts, never mixed:

- **Graph paper (constant).** Fixed grid: every major line = 1 cm apart, exactly **4 minor lines** between two majors (fifths: 0, 0.2, 0.4, 0.6, 0.8, 1). Teachers can never change this.
- **Scale (variable).** Answer to one question: *"1 cm = ___ units."* Only axis labels change; spacing does not.
- **Extend (structural).** Adds more graph units at the top of the Y-axis (or right of the X-axis). New grid lines appear above; scale unchanged.
- **Zoom (visual).** Magnifier — makes cm bigger/smaller on screen. Nothing mathematical changes.

A bar has **no stored value in units** — only a height in "graph units" (how many cm × current scale). A bar can never exceed the current Y-max; if the teacher wants a taller bar, they extend the graph first.

## 2. Direct On-Graph Editing

### Y-axis (top of vertical axis)
- Small **`⊕`** chip sits at the top of the Y-axis.
- Click → inline field: `1 cm = [___] unit`. Enter commits; the chip auto-hides after 10 s of no interaction.
- Below/beside it: **`Extend ▲`** button — adds one more cm of graph at the top (new major line + 4 minors), scale unchanged.

### X-axis (end of horizontal axis)
- Trailing **`⊕`** chip → adds a new bar (`Bar A`, `Bar B`, `Bar C` …).

### Each bar (hover to reveal, idle-hide)
```
        [ + ]
   ┌────────────┐
   │            │
   │   ██████   │
   │            │
   └────────────┘
        [ − ]
   [− Bar A +]
```
- `+` above bar → grow by one graph unit (1 cm × scale). Clamps at current Y-max with a subtle shake + tooltip *"Extend graph to grow further."*
- `−` below bar → shrink by one graph unit; clamps at 0.
- `−` / `+` flanking the label → shortcut to the same grow/shrink.
- Click the **label** → mini popover: Rename · Duplicate · Delete · Change color · **Bar width** (Thin / Normal / Wide / Automatic).
- Drag the top edge → resize, snapping to minor lines (0.2 cm).

Bar width is a **graph-level** property — changing it on any bar changes all bars (uniform width always).

## 3. Auto-Responsive Bar Layout

- The chart always fills the notebook column width; no fixed 5-bar cap.
- Bar width defaults to **Automatic**: computed from `plotW / nBars` with the "gap = bar width" rule for bar chart, `gap = 0` for histogram.
- Manual override: Thin (≈ 40 % of auto), Normal (100 %), Wide (≈ 160 %).
- Unlimited bars — 5, 50, 500, all fit; each bar simply narrows.
- Removes the current `canvasWidth` expand model (kept only under Advanced for teachers who want a bigger canvas beyond the notebook column).

## 4. Zoom vs Extend (distinct controls)

Live above the chart (small pill row, auto-hides after idle):

- **Zoom −  100 %  +** — CSS transform on the SVG wrapper. Visual only.
- **Extend Y ▲** — adds 1 cm to Y-axis max.
- **Extend X ▶** — adds one bar slot (same as trailing `⊕`).
- **Reset view** — restores zoom to 100 %.

## 5. What Moves to "Advanced" (collapsed panel)

Panel becomes a `<details>` block titled **Advanced settings**, closed by default. Contains the existing knobs that the teacher rarely needs:

- Canvas width / height override
- Explicit yMin / yMax / yStep
- Palette, fonts, legend position, presentation mode
- Grid / axis / tick styling
- Exam mode toggles

Everyday controls (title, X label, Y label) stay at the top of the panel above the Advanced fold.

Existing panel fields we **remove entirely** (redundant with new model): `yMinorDivisions` (locked to 4), `yScale.cmPerStep` (always 1 cm), `barWidthPct` (replaced by Thin/Normal/Wide/Auto).

## 6. Line Chart

Same y-scale model (1 cm = X units, Extend Y, fixed 4 minor divisions). X-axis gets the same trailing `⊕` to add points. Each point exposes `+ / −` on hover; label popover has Rename / Delete / Change color.

## 7. Out of Scope This Pass

Pie, scatter, dotplot, boxplot, ogive — untouched. Existing behaviour preserved.

---

## Technical Details

**Files to change**

- `src/components/lessonnotes/extensions/visuals/smartchart/types.ts`
  - Add `graph.majorPerCm = 1` (const), `graph.minorPerMajor = 4` (const, not exposed).
  - Replace `yScale` with `scale: { unitsPerCm: number }` (single number; default 5).
  - Replace `canvasHeight` growth with `axisMaxCm: number` (default 7 = 7 cm tall plot).
  - Replace `barWidthPct` with `barWidth: "thin" | "normal" | "wide" | "auto"`.
  - `bar.rows[i]` gains `heightCm: number` (bar height measured in cm, not raw value). Migration: existing `value` → `heightCm = value / unitsPerCm`, clamped.
  - `zoom: number` (1 = 100 %, range 0.5–3).

- `src/components/lessonnotes/extensions/visuals/smartchart/scale.ts`
  - New helpers: `cmToPx`, `unitsToCm`, `cmToUnits`, `axisTicks(axisMaxCm, unitsPerCm)`.
  - Deprecate old auto-Y logic — Y-axis is now purely `axisMaxCm × unitsPerCm`.

- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx`
  - Compute `plotW = notebookColumnWidth × zoom`, `cmPx = plotH / axisMaxCm`.
  - Render fixed grid: majors every `cmPx`, 4 minor lines between each.
  - Render Y-axis labels: `0, unitsPerCm, 2×unitsPerCm, … axisMaxCm × unitsPerCm`.
  - Add on-canvas overlays: top-Y `⊕` chip (scale editor + Extend ▲), trailing-X `⊕` (add bar), per-bar hover controls (+ / − / label popover), zoom pill row.
  - Auto bar width: `auto = plotW / (nBars × 2)` for bar chart, `plotW / nBars` for histogram.
  - Clamp `+` at `axisMaxCm × cmPx`; shake + tooltip when clamped.
  - Idle-hide overlays via existing `useHoverIdleVisibility`.
  - Move existing panel JSX under a `<details>Advanced</details>` block; keep only Title / X label / Y label above the fold.

- `src/components/lessonnotes/extensions/visuals/smartchart/LineChart.tsx` (or wherever line lives)
  - Apply the same Y-scale model, trailing `⊕`, per-point +/− and label popover.

- Migration in `normalizeChart`: read legacy `canvasHeight`, `barWidthPct`, `yScale`, `yMin/yMax/yStep`, `bar.rows[].value` and map into the new fields so existing notebooks keep working.

**Constants**
- `MINOR_PER_MAJOR = 4` (module const, never exposed to UI).
- `CM_PX_BASE = 40` (base px per cm before zoom; tuned so a 7-cm plot ≈ 280 px).

**Interaction**
- Reuse `useHoverIdleVisibility` (10 s idle) for the top-Y chip, trailing-X chip, and per-bar controls.
- Label popover reuses shadcn `Popover` with a compact vertical menu.

**Validation after implementation**
- Type-check.
- Manually verify in the preview: existing notebook charts still render (migration), adding a 20th bar auto-narrows all bars, `+` on a tall bar clamps and shakes, `Extend Y` adds one major line and preserves scale, `1 cm = 5` vs `1 cm = 20` changes labels only.
