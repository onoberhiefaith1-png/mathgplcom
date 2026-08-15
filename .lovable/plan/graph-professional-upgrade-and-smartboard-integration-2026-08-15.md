# Graph — Professional Upgrade and Smartboard Integration

Upgrade the existing Smart Graph (TipTap `smartGraph` node + `SmartGraphView`) into a wide, zoomable, function-aware graphing environment, and expose Diagram | Tables | Graph | Calculator | Conversion on the Smartboard's foldable top panel. The current plotting engine, expand/trim paper model, scale entry, overlays and geometry-inside-graph behaviour are all preserved — everything below is additive.

## Current state (verified)

- `src/components/lessonnotes/extensions/SmartGraph.tsx` stores everything in node attrs: `unitsPerSquareX/Y`, `squaresX/Y` (default 20x14 cm), `originSquareX/Y`, labels, `points`, `connect`, `shapes`, `overlays`. Undo/redo already flows through TipTap.
- `SmartGraphView.tsx` draws graph paper at a fixed `SQ = 28px` per cm, with four-sided Expand/Trim, Smart Scale suggestion, Plot/Cursor/Move modes, Insert overlays, and geometry drawing via `useGeometryMode` (diagrams already work inside the graph).
- There is no view zoom inside the graph (the file's comment defers zoom to the page header) and no function plotting at all.
- Smartboard: `PresentationView.tsx` already has 2D / 3D diagram buttons in the top strip, board-owned diagrams in `src/lib/smartboard/boardDiagrams.ts`, `BoardDiagramLayer`, and diagrams inside the unified history `Snap`. There is no Graph / Tables / Calculator / Conversion on the board yet.

## 1. Landscape canvas + zoom

- Change the default graph to landscape: `squaresX` 40, `squaresY` 16, origin centred (20, 8). Existing saved graphs keep their own values.
- The graph paper fills the available note width and scrolls horizontally when wider; it never gets clipped to a narrow column.
- Add a view-zoom layer that is separate from the mathematics: a `viewZoom` factor (and pan offset) scaling the rendered paper only. Scale (`1 cm = n units`), points, shapes, overlays and functions are untouched by zoom.
- Controls: `−` / `+` / `Reset` (100%) in the toolbar, ctrl/⌘+wheel and trackpad pinch anchored under the cursor using exponential zoom (`z * Math.exp(-dy * 0.0015)`, clamped 0.25–4) with a native non-passive wheel listener, and space/middle-drag pan. Plain wheel keeps scrolling the note.
- Expand/Trim remain exactly as they are (adding real graph paper), independent of zoom.

## 2. Function mode (new)

- New toolbar mode **Function** next to the existing **Plot** (Plot is unchanged).
- Function input renders as a locked template `y =` followed by one field — teacher types `2x + 3`, presses Enter, the curve plots immediately and is listed as a chip (colour swatch, visibility toggle, edit, delete).
- Optional domain fields on the same row: `from` / `to` (rendered as `-10 ≤ x ≤ 10`). Empty domain = plot across the whole current coordinate space, re-sampled whenever the paper is expanded or zoomed, so `y = 2x + 3` never ends mid-air.
- A **Library** dropdown offers ready templates that only pre-fill the field: Linear, Quadratic, Cubic, Reciprocal, Exponential, Square root, Modulus, Sine, Cosine, Tangent. Typing `sin(x)` manually works the same way.
- Sampling is per screen pixel column with asymptote/discontinuity breaks (reciprocal, tan) so curves are not joined across poles, and clipping to the paper rectangle.

## 3. Graph Style

- New **Style** panel (inside the existing collapsible `More` area, so the main toolbar stays as clean as it is today): background colour, axis colour and thickness, number/label colour, major and minor grid colour, minor-grid density, plus per-function colour, thickness and line style (solid / dashed / dotted) and point appearance (dot / cross / circle, size).
- Defaults are exactly today's white paper look; style is presentation-only and never affects mathematics.

## 4. Interactive tools (kept out of the main toolbar)

Under `More` → Analyse: inspect point / coordinate readout on hover, gradient at a point, tangent line at a point, and intersections between two plotted functions. Each result is drawn as an existing-style overlay so it persists with the node.

## 5. Diagram inside Graph

Unchanged behaviour, verified after the rework: with a geometry tool active, clicks inside the graph still create geometry shapes in data coordinates, now correctly mapped through the new zoom/pan transform.

## 6. Smartboard integration

- Add to the Smartboard foldable top panel, beside the existing 2D/3D buttons: **Graph**, **Tables**, **Calculator**, **Conversion**.
- Graph and Tables become board-owned objects in `boardDiagrams.ts` (extended to a general board-object union with `kind: "graph" | "table"` carrying the same attrs shape as the lesson-note nodes) so they are draggable, persisted per board page, and included in the unified history `Snap` alongside diagrams.
- Graph on the board renders the same `SmartGraphView` engine (extracted into a presentation-agnostic inner component driven by `attrs` + `onChange`, with the TipTap node view as a thin wrapper) — one Graph system, no weaker board variant. Function, zoom, style and analyse tools all work there.
- Calculator and Conversion open as transient panels (existing `SmartCalculator` / `ConversionPanel`), not stored board objects.
- Lesson Notes keeps its existing Diagram / Tables / Graph / Calculator / Conversion buttons — no changes there.

## 7. Transfer rules

- Tools (Graph, Tables, Calculator, Conversion) are never auto-duplicated from a lesson note into the board; the board opens its own.
- 2D diagrams that belong to presented lesson content continue to travel with that content and stay diagrams — they are excluded from floating-number conversion and rendered as an attached, unaligned diagram element next to the floating-number stream.
- 3D diagrams never auto-transfer; the teacher recreates them on the board with the existing 3D button.

## Technical notes

- Files touched: `extensions/SmartGraph.tsx` (new attrs: `functions[]`, `style`, `viewZoom`, `viewPanX/Y`, landscape defaults, sanitising for old nodes), `math-tools/SmartGraphView.tsx` (split into `GraphSurface` core + node-view wrapper; zoom/pan; Function mode; Style panel; Analyse), new `src/lib/graph/functions.ts` (expression parse + safe evaluation + sampling with discontinuity breaks) and `src/lib/graph/library.ts` (school function templates), `src/lib/smartboard/boardDiagrams.ts` + `BoardDiagramLayer.tsx` (graph/table board objects), `PresentationView.tsx` (top-panel buttons, history `Snap` entries, calculator/conversion panels), and the floating-number materialiser to keep 2D diagrams out of numeric conversion.
- No database changes: graph state lives in note content JSON and the existing board bucket.
- All new attrs are defaulted and sanitised so existing saved graphs and boards load unchanged.

## Verification

Run the nine tests from the brief: linear function via Function mode, zoom out/in correctness, landscape width, style changes with unchanged mathematics, diagram inside graph, lesson note storing graph + diagram, Smartboard top panel with all five tools, 2D diagram travelling with presented content, and 3D not auto-transferring.
