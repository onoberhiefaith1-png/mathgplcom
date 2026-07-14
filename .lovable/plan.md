## Goal
Rework the Smart Chart Bar Chart so it behaves like a mathematics graphing tool, not a business chart. Every bar becomes a mathematical object with an X position (category) and Y value (height), plotted against a teacher-defined scale.

All edits stay in `src/components/lessonnotes/extensions/visuals/smartchart/` — the shared `SmartChart` dispatcher, node schema, and other chart kinds are untouched.

## Changes

### 1. Vertical bars only
- Remove any current or planned horizontal-orientation code path in `BarChart.tsx`.
- Bars always grow upward from the X-axis baseline (y = 0 or y = yMin, whichever is larger).
- No orientation toggle in the Properties Panel.

### 2. Mathematical Y-axis scale (manual)
Extend `SmartChartAttrs` in `types.ts` with an explicit interval:
- `yMin: number | null` (already exists)
- `yMax: number | null` (already exists)
- `yStep: number | null` (new) — the tick interval

Panel behaviour:
- When "Auto-scale Y" is ON: current `niceDomain` logic runs and picks a friendly step automatically. `yMin/yMax/yStep` inputs hidden.
- When "Auto-scale Y" is OFF (Manual Scale): show three inputs — Minimum, Maximum, Interval. Ticks are generated as `min, min+step, min+2·step, …, max` and rendered on the Y-axis. Bars scale against this exact domain.

Update `scale.ts`:
- Add `manualScale(min, max, step)` that returns `{min, max, step, ticks}` walking `min → max` by `step` (guarding step > 0 and tick count ≤ ~40).
- `resolveYScale` takes the new `yStep` and, in manual mode, calls `manualScale` instead of `niceDomain`.

### 3. Coordinate-based bars
Model each bar as `{ label, value }` where:
- `label` is the X category (mathematics, english, …)
- `value` is the Y value, interpreted against the current scale
- Bar height = pixel distance from `yToPx(0 or yMin)` to `yToPx(value)`

This is already how the data is stored; the plan is to rename the panel UI to match the mathematical language:
- "Bar N label" → **"X position (category)"**
- "Value" → **"Y value"**
- Section header "Data" → **"Bars (X, Y)"**

The teacher enters a category name and a Y value; the chart computes the bar height from the scale — no manual pixel/width math.

### 4. Drag-to-edit ↔ numeric sync
The drag handle already exists. Refinements:
- Dragging clamps to `[scale.min, scale.max]` (works for both auto and manual scales).
- Snap the dragged value to the nearest `scale.step / 10` (so a step of 5 snaps to 0.5 increments) so drags feel precise but continuous. Round to 1 decimal, matching current behaviour.
- Updating the numeric field re-renders the bar immediately (already the case — verify after the rename).
- Numeric input in the panel gains `step={scale.step / 10}` so the arrow keys move in scale-aware increments.

### 5. Panel cleanup
Keep only mathematics-relevant controls in the Bar Chart panel:
- **Bars (X, Y)** — list of bars with X position, Y value, colour, remove; "Add bar" button.
- **Y-axis (scale)** — title, auto-scale toggle, and (when manual) min / max / interval.
- **X-axis** — title, show tick labels toggle.
- **Appearance** — equal bar width toggle, bar width, gap, gridlines, border thickness, show Y values above bars.
- **Universal tools** — unchanged (CSV, reset, presentation, lock, show answers).

Remove nothing from the underlying data model; only reorganise labels/sections.

## Technical notes

Files touched:
- `src/components/lessonnotes/extensions/visuals/smartchart/types.ts` — add `yStep` to `SmartChartAttrs` and `normalizeChart` defaults (`yStep: null`).
- `src/components/lessonnotes/extensions/visuals/smartchart/scale.ts` — add `manualScale`; update `resolveYScale` signature to accept `yStep`.
- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — rename panel labels, wire manual min/max/interval inputs, pass `yStep` to `resolveYScale`, snap drag to `step/10`, ensure bars always draw vertically from baseline.

Out of scope:
- Placeholder chart kinds (pie, histogram, scatter, line, dotplot, boxplot, ogive) — untouched this phase.
- SmartChart dispatcher, LivingDiagram integration, palette entries.
- Any AI/backend behaviour.

## Acceptance
- Bars always vertical, growing from the X-axis.
- Toggling Manual Scale reveals Minimum / Maximum / Interval inputs; ticks match exactly (e.g. 0, 5, 10, …, 50).
- Editing a bar's Y value updates the bar height; dragging the bar top updates the Y value; both stay in sync.
- Panel language uses "X position" and "Y value" for each bar.
- Auto scale still works as before when the toggle is on.
