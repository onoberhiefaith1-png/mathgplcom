## Smart Mathematics Toolkit — Tables, Graph, Calculator

Add three new insertable tools next to the **Diagram** button in the Lesson Notes toolbar, following the same model as Smart Geometry: AI generates the object, teacher edits everything, content lives as a TipTap node embedded in the lesson note.

### Toolbar additions
In `src/components/lessonnotes/DocumentEditor.tsx`, next to the Diagram button, add:
- **Tables** (📊 icon) → opens Mathematical Tables picker, inserts `mathTable` node
- **Graph** (📈 icon) → inserts a `smartGraph` node and opens scale dialog
- **Calculator** (🧮 icon) → opens calculator popover; "Insert as working" inserts a `smartCalc` node

Each tool inserts a block node at the current cursor (same insertion pattern as `geometryDiagram`).

---

### PART 1 — Smart Mathematical Tables

**New TipTap node**: `mathTable` (block, atomic, with `attrs: { tableId, input, rows }`).

**Picker UI** (`MathTablesPicker.tsx`): Collapsible list mirroring the textbook ToC. Catalog in `src/lib/tables/catalog.ts`:
- Section A: Logarithms, Antilogarithms, Reciprocals, Squares, Square Roots, Cubes, Natural Logs, Exponentials, Negative Exponentials, Sin/Cos/Tan, Log Sin/Cos/Tan, Degree↔Radian, Sin/Cos/Tan (Radians)
- Section B: Binomial Coefficients, Normal, t, Chi-square, F (5% & 1%), Factorials

Each entry: `{ id, name, validRange, headings, generate(input) → { rowLabel, mainCols, diffCols } }`.

**Generation**: Pure JS (no AI) — `src/lib/tables/generators/*.ts` computes the exact row plus 0–9 main columns and 1–9 difference (mean diff) columns, matching textbook layout. Example for `log` with 55.24: row label `55`, columns 0–9 = log(55.0)…log(55.9) to 4dp, diff cols = mean differences.

**Validation**: If input outside range, show inline message: "Enter a value between {min} and {max}."

**Renderer** (`MathTableView.tsx` NodeView):
- Monospace, textbook styling, fixed column widths
- `overflow-x: auto` on wrapper — never shrink, never wrap
- Highlight the looked-up cell (e.g. row 55, col 2, diff 4)
- Editable cells via `contentEditable` per cell; "Regenerate" button restores generated values
- Top bar shows: table name, input value (editable → re-generates), Regenerate, Delete

---

### PART 2 — Smart Graph

**New TipTap node**: `smartGraph` (block, atomic, with `attrs: { scale, axes, data, plots }`).

**Flow on insert**:
1. Scale dialog: choose `1 square = N units` for X and Y (or `1 cm = N units`)
2. Node renders full-width SVG workspace with auto X/Y axes, origin, gridlines, tick labels

**Workspace** (`SmartGraphView.tsx`):
- Sticky data table at top (editable rows of `{x, y}`)
- Scrollable SVG canvas below (horizontal + vertical scroll), grid never compressed
- Toolbox: Point, Connect (Straight / Smooth Curve / Broken / Scatter), Move Axis, Reposition Origin, Rename Axes, Change Scale, Resize
- Plot by clicking canvas → snaps to grid → adds point to data table
- "Connect" joins selected points in chosen style; result is editable polyline/curve

**State**: All scene data stored in node `attrs`; updated via `updateAttributes`. History via TipTap.

---

### PART 3 — Smart Calculator

**Two modes** in one popover (`SmartCalculator.tsx`), toggled by tabs:

**Standard** — scientific calculator UI:
- Basic ops, fractions, powers, roots, sin/cos/tan, log, ln, exp, memory (M+ M- MR MC), DEG/RAD toggle
- Uses `mathjs` (already-friendly evaluator) for evaluation
- "Copy result" only — does not insert into the note

**Smart** — working-shown mode:
- Teacher types/speaks an expression or word problem
- Calls existing AI gateway (Lovable AI, `google/gemini-3-flash-preview`) via a new edge function `smart-calc` that returns `{ formula, substitution, steps[], answer }` as JSON
- "Insert into note" creates a `smartCalc` node showing formula, substitution, steps, answer — every line editable; "Recalculate" re-runs AI; "Convert to prose" turns it into normal paragraph nodes

---

### Shared philosophy
- All three nodes are TipTap block nodes with NodeViews — same lifecycle as `geometryDiagram`
- Every generated value is editable; nothing is locked
- "Regenerate" never overwrites teacher edits without confirmation
- All UI uses existing design tokens (no hardcoded colors)

### Technical summary
- New files:
  - `src/components/lessonnotes/extensions/MathTable.tsx`, `SmartGraph.tsx`, `SmartCalc.tsx` (TipTap nodes + NodeViews)
  - `src/components/lessonnotes/math-tools/MathTablesPicker.tsx`, `SmartGraphView.tsx`, `SmartCalculator.tsx`
  - `src/lib/tables/catalog.ts` + `src/lib/tables/generators/*.ts` (pure-JS table math)
  - `src/lib/graph/scale.ts` (axis/tick math)
  - `supabase/functions/smart-calc/index.ts` (AI step-by-step working)
- Edits:
  - `DocumentEditor.tsx` — register 3 nodes, add 3 toolbar buttons next to Diagram
- Dependency: add `mathjs` for calculator evaluation
- No DB schema changes — everything persists inside `document_json`

### Out of scope (this round)
- Cross-linking graph ↔ table data (later)
- Exporting tables/graphs to DOCX (later)
- Student-side interactive plotting in Smartboard (later)
