## Rework Bar Chart / Histogram to behave like a graph with a Y-axis scale

Fix three concrete problems with the current Smart Chart:

1. **Bar width is stuck at ~50%** and cannot be reduced from the panel.
2. **Y-axis "scale" is a chart-style auto-tick**, not a mathematical scale like `2 cm : 1 unit`.
3. **Gap between bars is arbitrary**; it should mathematically equal the bar width in Bar Chart mode, and be zero in Histogram mode.

---

### 1. Bar width as a % of the plot area (default 10%)

- Remove the current "Bar width (px)" + "Gap (px)" model.
- Replace with a single control: **Bar width = N% of plot width** (default `10`, range `1–50`, step `0.5`).
- Layout math per row (Bar Chart mode):
  - `barPx = plotWidth * barWidthPct / 100`
  - `gapPx = barPx`  (rule: gap = width)
  - `slotPx = barPx + gapPx = 2 * barPx`
  - Bars are laid out left-to-right at their category X position; the plot area can therefore hold `plotWidth / slotPx` bars before overflow (≈ 5 at 10%, up to ~50 at 1%).
- Histogram mode: `gapPx = 0`, bars touch, `slotPx = barPx`. Everything else identical.
- New `SmartChartAttrs` fields (in `types.ts`):
  - `barWidthPct: number` (default 10)
  - Deprecate `bar.barWidth` and `bar.gap` — kept only for back-compat read, ignored on render.
- Panel section **Bar Layout** becomes: `Bar width (%)` slider/number only. `Equal width` toggle stays.

### 2. Y-axis "cm : unit" scale (graph-style)

Replace the current `yAuto / yMin / yMax / yStep` UI in the Scale group with a real mathematical scale definition:

- **Scale mode**: `Auto` | `Manual`.
- When **Manual**:
  - `cm per step` (default 1) — visual size of one grid step, in the same "cm" units the geometry graph already uses.
  - `unit per step` (default 1) — how many data units one step represents.
  - `Y max` (default 10) — the top of the axis in data units.
  - `Y min` (default 0).
  - Derived: `stepValue = unitPerStep`, `numSteps = (yMax - yMin) / stepValue`, major ticks at `yMin, yMin+step, …, yMax`.
  - Plot height in px is derived from `cmPerStep * numSteps * PX_PER_CM` so `5 cm : 1 unit` with max 40 produces 8 major intervals each 5 cm tall, labelled 0, 5, 10, …, 40 (matching the user's spoken example when read as `5 units per 1 step, max 40`).
- When **Auto**: current `resolveYScale` behaviour, but the label above the mode row shows the derived `"1 cm : X unit"` so it still reads like a graph.
- New `SmartChartAttrs` fields:
  - `yScale: { mode: "auto" | "manual"; cmPerStep: number; unitPerStep: number; min: number; max: number }`
  - Legacy `yAuto/yMin/yMax/yStep` migrated into `yScale` in `normalizeChart`.
- `scale.ts` gets a new `resolveManualScale(yScale)` returning `{ min, max, step, ticks, pxPerUnit }`, and `BarChart.tsx` uses `pxPerUnit` for both the plot height and every `yToPx` call so ticks land on exact centimetre boundaries.
- Minor divisions stay (default 5) — they subdivide one `unitPerStep`.

### 3. Bar chart vs Histogram spacing rule

- In Bar Chart mode: `gap = width` always (no separate gap control; remove "Gap between bars" from the panel).
- In Histogram mode: `gap = 0` always; bars share borders.
- `displayMode` toggle in the panel keeps its current place under **Display Mode**.

### 4. Panel changes (right-hand Properties Panel)

Inside the existing 17-section layout, only these sections change:

- **Scale** — becomes: Mode (Auto/Manual), cm per step, unit per step, Y min, Y max, Minor divisions. Live readout: `1 cm : X unit`.
- **Bar Layout** — becomes: Bar width (%), Equal width toggle. Remove Bar width (px) and Gap fields.
- **Display Mode** — unchanged (Bar chart / Histogram).

All other sections (Axes, Grid, Ticks, Numbers, Data Labels, Colours, Fonts, Legend, Graph Area, Exam Mode, Presets, Universal Tools) stay as they are.

---

### Files touched

- `src/components/lessonnotes/extensions/visuals/smartchart/types.ts` — add `barWidthPct`, `yScale`; migrate legacy fields in `normalizeChart`.
- `src/components/lessonnotes/extensions/visuals/smartchart/scale.ts` — add `resolveManualScale`; keep `niceDomain` for Auto mode.
- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — new layout math (percent width, gap=width or 0), new Scale panel section, new Bar Layout panel section, `pxPerUnit`-driven Y mapping.
- `.lovable/plan.md` — record the change.

No other assets, no backend, no AI-flow changes.

---

### Acceptance checks

- Default insert of a Bar Chart produces bars whose width is ~10% of plot width and whose spacing equals that width.
- Panel slider "Bar width (%)" moves bars from thin (~1%) to wide (~50%) live.
- Setting Manual scale `cm per step = 5`, `unit per step = 1`, `Y max = 40` produces exactly the axis labels `0, 5, 10, 15, 20, 25, 30, 35, 40` with equal 5-cm gaps.
- Switching to Histogram mode collapses the gap to zero and the bar edges touch, without changing the Y scale.
