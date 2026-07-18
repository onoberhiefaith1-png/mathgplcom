
# Geometry Diagram Editor — Rebuild Around 5 Core Tools

Rebuild the geometry editor around a strict model: **five construction tools on the left, canvas in the middle, one context-sensitive editing panel on the right**. Everything else (angles, distances, marks, shading, measurements) is applied by clicking a constructed object — never by picking a new tool.

Delivered in **phases** so each ships and is testable on its own. Phase 1 is the foundation. Later phases add tools and intelligence on top of it without changing the shape of the app.

---

## Phase 1 — Foundation: scene model, left toolbar, right panel, Point tool

**Goal:** Teachers can pick the Point tool, place points, drag them, rename/recolour/hide them via the right-hand panel. No other tools yet. This proves the whole architecture.

- New scene model `src/lib/geometry/v2/scene.ts` with a small, connected graph:
  - `Point { id, x, y, labelText, labelPos, color, hidden }`
  - `Line { id, aId, bId, style: solid|dotted|dashed, arrow: none|end|start|both, marks: none|1..4, parallel: none|1..3, distanceText?, distancePos?, color }`
  - `Circle { id, centerId, radiusId, style, color, labelText?, labelPos? }`
  - `Arc { id, startId, centerId, endId, style, color, labelText? }`
  - `Curve { id, pointIds: [], style, color, labelText? }`
  - `Region { id, boundary: [{objId, dir}], fill, opacity }` (populated in Phase 6)
  - All objects reference **point ids**, so dragging any point automatically reshapes every connected object.
- Replace the existing left-hand `GeometryToolbox` with a minimal vertical rail showing exactly five tools: **Point, Line, Circle, Arc, Curve** — plus a Select cursor at top. No other tool ever appears here.
- Right-hand panel:
  - Reuse the existing universal `PropertiesPanel` + `useRegisterAssetEditor` mechanism (already used by all other assets — matches the "Universal editing" core memory).
  - Panel is empty (or folded) when nothing is selected. Opens automatically the moment an object is selected. Clears the moment the teacher clicks empty canvas.
  - Only **one** editor context is ever mounted — selecting a new object replaces the previous editor entirely.
- **Point tool behaviour:**
  - Click on empty canvas → create point with next free label (`A`, `B`, … `Z`, then `A1`, `B1`, …), reusing `nextPointLabel` logic.
  - Click on an existing line/circle/arc/curve while Point tool is armed → create a new point **on** that object (Phase 5 makes it constrained; Phase 1 just snaps to the geometry).
  - Point is rendered as a small, dark, thicker-than-line dot. Label is a separate hit target near the point.
  - Selecting a point registers its editor into the right panel with only:
    - Rename Label (inline text input)
    - Point Colour (swatch row)
    - Hide Point (hides dot **and** label without deleting; connected geometry stays)
  - Selecting the label (not the dot) shows a mini label editor: Rename, Drag position (drag handle on canvas), Label Colour.
  - Dragging the point updates its `x/y` and every connected object re-renders from the graph.
- Deprecate old files rather than deleting them in Phase 1 so nothing else breaks:
  - `GeometryToolbox.tsx`, `GeometryToolbar.tsx`, `GeometryEditorPanel.tsx`, `RelationshipPanel.tsx`, `RelationshipEditorSheet.tsx`, `SelectionInspector.tsx`, `SmartOverlay.tsx`, `SmartGeometryContext.tsx`, `useGeometryEditor.ts`, `src/lib/geometry/editor/tools.ts` — kept on disk but no longer imported by the new editor. `DocumentEditor.tsx` and `GeometryDiagram.tsx` switch to the new components.

**Definition of done for Phase 1:** open a geometry asset → place several points → drag them → rename, recolour, hide, show them → close panel by clicking empty canvas.

---

## Phase 2 — Line tool

- Line tool: click point A, click point B → creates `Line`. If click lands on empty canvas, auto-create a point there first (fast classroom flow).
- Selecting a line body opens **Line Properties** in the right panel with collapsible sections, only Basic Line expanded by default:
  - ▼ Basic Line: Solid / Dotted / Dashed
  - ▶ Arrow: None / End / Start / Both
  - ▶ Equality Marks: None / 1..4 ticks
  - ▶ Parallel Marks: None / 1..3 marks
  - ▶ Distance: "Add Distance" inserts an editable placeholder anchored to the line; teacher types free text ("30 cm", "2x+3"); label is draggable around the line; delete removes only the label.
  - Colour swatch (line only, not endpoints).
- Selecting endpoints still opens Point Properties (endpoints are just points).
- Line label is a separate editable object like the point label.

---

## Phase 3 — Circle tool (two-point compass model)

- **Remove** the current three-point circle construction. Circle = **centre point + radius point**.
- Click 1 = centre, click 2 = radius point → circle is created plus a visible radius **Line** between them.
- The radius line is a normal `Line` and gets the full Line Properties when clicked (marks, distance, style, colour, arrow…).
- Selecting the **circumference** opens Circle Properties:
  - ▼ Circle Appearance: Line Colour, Line Thickness, Line Style (Solid/Dotted/Dashed)
  - ▼ Fill Region: Fill Colour, Fill Opacity, Remove Fill (initially fills the whole disc; Phase 6 replaces this with per-region fills)
- Dragging the centre translates the whole circle (radius vector preserved); dragging the radius point resizes it. Every connected object updates from the point graph.
- Optional circle label (e.g. `O`) — draggable around the circumference.

---

## Phase 4 — Arc and Curve tools

- **Arc:** three clicks — Start, Centre, End. Creates an `Arc` following the circumference of the implied circle from Start to End in the natural swept direction. All three points remain draggable and reshape the arc live.
- Arc Properties: ▼ Appearance (colour, thickness, style), ▼ Fill Region (activated once the arc participates in a closed boundary — Phase 6), draggable label.
- **Curve:** click multiple points, double-click / Enter to finish. Stores an ordered `pointIds` list; renders a smooth spline (Catmull-Rom → cubic Bézier) passing through every control point. Every control point remains draggable.
- Curve Properties: ▼ Basic Curve (Solid/Dotted/Dashed), ▼ Appearance (colour, thickness), ▼ Fill Region (Phase 6), draggable label.

---

## Phase 5 — Point-on-object and point redefinition

- With the Point tool armed, clicking within a snap tolerance of an existing line / circle / arc / curve creates a **constrained** point on that object:
  - Point stores `{ onObjectId, t }` where `t` is a parametric position along the host (0..1 for line/curve, angle for circle/arc).
  - Dragging that point slides it along the host object.
  - If the host object moves, the constrained point follows automatically.
- "Hide Point" already exists from Phase 1. Add a canvas-level **Show Hidden Points** toggle (right panel default state, when nothing is selected) so teachers can recover previously hidden points at their original positions. Geometry never moves when a point is hidden or restored.

---

## Phase 6 — Enclosed regions (the intelligence layer)

- Continuously derive `Region[]` from the current scene by planarising the arrangement of every line segment, circle, arc and curve segment (approximate curves/arcs by fine polylines for topology, but render the true curve for display).
- Algorithm outline:
  1. Compute all pairwise intersections between rendered objects; split each object into sub-edges at intersection points.
  2. Build a planar graph (vertices = points + intersections, edges = sub-edges).
  3. Extract bounded faces via the standard "next edge counter-clockwise" traversal. The unbounded outer face is dropped.
  4. Each bounded face becomes a `Region` with a stable id derived from the sorted edge signature so fills survive small geometry edits.
- Hit-testing: click inside canvas but not on any object → point-in-polygon against region polylines → select that region.
- Selecting a region opens Region Properties: **Fill Colour**, **Fill Opacity**, **Remove Fill**. Nothing else.
- Regions recompute automatically after every point drag. Fills stay attached to their region across small edits via the edge-signature id; when a region is destroyed (boundary opens), its fill is dropped.
- Rules covered by construction, not special-cased:
  - Circle alone → one region.
  - Radius (only touches boundary once through centre) → still one region.
  - Diameter (touches boundary twice) → two regions.
  - Any further chord/arc that fully splits an existing region → more regions.
  - Polygons formed by lines/arcs/curves work identically.

---

## Phase 7 — Two-line angle selection (bonus, on top of the region model)

When the current selection is exactly **two lines sharing an endpoint**, the right panel replaces its content with **Angle Properties**: Add Angle (auto-computed °), Right-angle marker, Angle Colour, Add placeholder text. The angle marker is rendered at the shared vertex. No new left-side tool.

---

## Right-hand panel behaviour (applies to every phase)

- Uses the existing `AssetSelectionProvider` / `useRegisterAssetEditor` so behaviour matches the rest of the app.
- Selection → panel auto-opens with only the current object's editor.
- Change selection → previous editor unmounts, new one mounts. No accumulation, no tabs.
- Click empty canvas → deselect → panel clears (and folds if the user previously folded it).
- Panel never contains construction tools. Left rail never contains editing options.

---

## Technical notes

- **File layout** (new):
  - `src/lib/geometry/v2/scene.ts` — types + graph operations (addPoint, addLine, addCircle, addArc, addCurve, movePoint, hidePoint, deleteObject).
  - `src/lib/geometry/v2/regions.ts` — planarisation + region extraction (Phase 6).
  - `src/lib/geometry/v2/hitTest.ts` — pointer → object / label / region.
  - `src/components/lessonnotes/geometry-editor/v2/GeometryEditor.tsx` — top-level component: left rail, canvas, mounts current object's editor via `useRegisterAssetEditor`.
  - `src/components/lessonnotes/geometry-editor/v2/CanvasSVG.tsx` — renders points, lines, circles, arcs, curves, regions.
  - `src/components/lessonnotes/geometry-editor/v2/tools/{PointTool,LineTool,CircleTool,ArcTool,CurveTool,SelectTool}.ts` — one file per tool, each a small state machine for the interaction.
  - `src/components/lessonnotes/geometry-editor/v2/panels/{PointPanel,LinePanel,CirclePanel,ArcPanel,CurvePanel,RegionPanel,AnglePanel}.tsx` — right-hand editors, one per selection kind.
- **Storage/migration:** the new scene lives on the existing geometry node's `attrs.sceneV2`. If only the legacy `scene` exists, best-effort convert (points → v2 points, segments → v2 lines with both endpoints as v2 points, circles → v2 circles synthesising a radius point on +x, arcs → v2 arcs synthesising start/end points). Legacy scenes without a v2 payload keep rendering through the old renderer until the teacher touches the diagram, at which point they're migrated on first save.
- **Rendering:** all objects are rendered from the point graph on every frame — no cached geometry — so dragging a point automatically updates every connected object without bespoke propagation logic.
- **Fills:** rendered as SVG `<path>` elements built from region polylines under all boundary objects so strokes overlay fills correctly.
- **Curves:** Catmull-Rom-to-Bézier for display; for planarisation, sample at a resolution high enough for reliable intersection (e.g. 32 samples per control-point interval, refined near intersections).
- **Performance:** region recomputation is O(n² intersection tests) but n is small in classroom diagrams (< ~50 primitive edges). Recompute is debounced during drag and finalised on pointer-up.
- **Undo/redo:** every mutation goes through a single reducer on the scene; keep a simple history stack (reuse `history.ts` pattern).

---

## Suggested build order

1. Phase 1 (Point + panel + left rail + scene model) — ship, verify.
2. Phase 2 (Line).
3. Phase 3 (Circle — two-point).
4. Phase 4 (Arc + Curve).
5. Phase 5 (Point-on-object, hide/show).
6. Phase 6 (Region detection + fills).
7. Phase 7 (Two-line angle bonus).

Each phase is a self-contained, testable milestone. If you'd like, I can also fold Phase 7 into Phase 2 as soon as lines exist — let me know.

Approve this plan and I'll start with Phase 1.
