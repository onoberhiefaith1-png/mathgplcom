## Goal

Make Pie Chart and Histogram first-class SmartChart kinds, matching the Bar Chart's full-width "graph paper" behavior. Keep the design mathematically simple: Pie = percentages summing to 100; Histogram = Bar Chart with bars touching.

---

## 1. Histogram (fast path — reuse BarChart)

Currently `SmartChart.tsx` already routes `kind === "histogram"` to `BarChart`. The only missing piece is the visual difference: **bars touch** (no gap).

**Changes**
- In `BarChart.tsx`, when `attrs.kind === "histogram"` OR `attrs.displayMode === "histogram"`:
  - Force inter-bar gap to `0` when computing bar geometry.
  - Ensure adjacent bar borders don't double up (draw a single shared edge, or set right-border=0 except on last bar).
- Everything else — full-notebook width, cm scale, `+`/`−` controls, label editor, Properties Panel, text-colour, add/delete row — inherited unchanged from Bar Chart.
- Properties Panel title shows "Histogram" when kind is histogram.

No new files. One conditional in `BarChart.tsx`.

---

## 2. Pie Chart (new component)

### Data model (extend `types.ts`)
`PieSector` already exists. Reuse:
```ts
PieSector { name: string; value: number /* percentage 0–100 */; color?: string }
```
Add `pie` payload defaults in `normalizeChart`:
```ts
pie: {
  sectors: [],                       // empty by default — blank circle
  labelMode: "category+percent",     // "category" | "percent" | "category+percent" | "none"
}
```
Remove the old `labelPos`/`showPercent`/`showAngle` fields from the panel — replaced by a single `labelMode`.

### New file: `src/components/lessonnotes/extensions/visuals/smartchart/PieChart.tsx`

**Rendering**
- Full-notebook-width block (same wrapper treatment `MathVisual.tsx` already applies to `family === "smartChart"`).
- SVG viewBox sized to a square that fills the column width; circle centred.
- Sectors drawn clockwise starting at 12 o'clock (−90°). Angle per sector = `pct / 100 * 360`.
- Empty state: single grey circle outline, no sectors, no labels.
- Each sector filled with its `color` (auto-assigned from `DEFAULT_PALETTE` by index if unset).
- Labels per `labelMode`, positioned at sector centroid. If sector < 6%, label rendered outside with a leader line so it stays readable.

**Interaction**
- Click sector → selects that row in the Properties Panel (visual highlight).
- No on-canvas +/− (unlike Bar Chart — pie is percentage-driven, not cm-driven).
- Selecting the chart opens Properties Panel via the existing `editorOpen` path in `LivingDiagram.tsx` (already special-cased for smartChart).

### Properties Panel (right side, `useRegisterAssetEditor`)

Sections, in order:

1. **Chart type** — dropdown (already shared); switching to `bar`/`histogram` swaps renderer.
2. **Sections** — table of rows:
   - Category (text input)
   - Percentage (number input, 0–100, 1 decimal)
   - Colour (swatch + picker)
   - Delete (trash icon)
3. **[+ Add section]** button — appends a new empty row with next palette colour.
4. **Totals display** (read-only):
   ```
   Current total:  70%
   Remaining:      30%
   ```
   Remaining shown in green if ≥ 0, red if the last edit would overflow.
5. **Labels** — segmented control: `Category` / `Percentage` / `Category + Percentage` / `None`.
6. **Title** — same shared title field other kinds use.

### Validation rules
- Percentage input clamps at `0` and at `100 - sumOfOthers`.
- If the teacher types a value greater than remaining:
  - Reject the write.
  - Show inline error under that row:
    - If existing sections already fill part of the pie: `"Only X% remains. Enter a value ≤ X%."`
    - If it's the first section and value > 100: `"A single section cannot exceed 100% of the pie chart."`
- Non-numeric / negative → clamped to 0 silently.
- Sum can be < 100 (partial pie is allowed; the unused arc renders as a light dashed outline so the teacher sees what's left).

### Ordering
- Sectors render in array order, top-to-bottom in the panel = clockwise on the circle.
- Row drag-handle to reorder (reuse the same drag-handle pattern used in Bar Chart rows if present; otherwise up/down arrow buttons — minimal, no dnd library).

### Colour defaults
- New row's colour = `DEFAULT_PALETTE[sectors.length % palette.length]`.
- Colour picker input has readable text (`text-foreground`, `bg-background`) matching the fix already applied to the bar rename input.

---

## 3. Wiring

- `SmartChart.tsx`: add branch `if (model.kind === "pie") return <PieChart .../>`. Remove the placeholder path for `pie`.
- `MathVisual.tsx`: already treats `family === "smartChart"` as full-width block — pie inherits this automatically.
- Asset registry (`src/lib/lessonnotes/assets/…`): confirm the "Pie chart" tile inserts `mathVisual` with `family: "smartChart"`, `attrs: { kind: "pie" }`. If it currently inserts something else, point it at SmartChart.

---

## Files to touch

- `src/components/lessonnotes/extensions/visuals/smartchart/types.ts` — pie payload defaults, drop legacy pie fields.
- `src/components/lessonnotes/extensions/visuals/smartchart/SmartChart.tsx` — route `pie` to new component.
- `src/components/lessonnotes/extensions/visuals/smartchart/BarChart.tsx` — zero-gap branch for histogram.
- `src/components/lessonnotes/extensions/visuals/smartchart/PieChart.tsx` — new.
- Asset registry entry for Pie / Histogram (verify only; edit if wired to placeholder).

## Out of scope (intentionally)

- No exploded slices, 3D, drop shadows, sector rotation, or start-angle controls.
- No angle input — percentages only; the software converts to degrees internally for rendering.
- No legend toggle in v1 (labels-on-sector cover the classroom use case); can be added later.
