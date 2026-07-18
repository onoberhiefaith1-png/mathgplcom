## Goal

Kill the V2 rebuild. Restore the working geometry engine, trim its toolbox to the five tools you want, wire selections into the right-hand Properties Panel, and remove the diagram frame so the whole lesson note becomes the drawing board.

## 1. Delete the V2 rebuild

- Remove `src/components/lessonnotes/geometry-editor/v2/` entirely (LeftRailV2, CanvasSVGV2, GeometryEditorV2, PointPanel, StaticV2Render).
- Remove `src/lib/geometry/v2/` (scene.ts, migrate.ts).
- Remove the `sceneV2` attribute and all v2 imports from `src/components/lessonnotes/extensions/GeometryDiagram.tsx`. The node goes back to rendering the existing `GeometryCanvas` (interactive) / static SVG using the legacy `scene` attribute only — no migration, no duplicate storage.

## 2. Trim the existing Geometry toolbox to five tools

The left-hand Geometry panel already works (screenshot 2). Keep only:

| Slot | Tool | Source |
|---|---|---|
| 1 | Point | existing `point` |
| 2 | Line | existing `line` |
| 3 | Circle | **replace** — bind the Circle slot to the existing `compass` tool (centre + radius point). Delete the current 3-point `circle` behaviour. |
| 4 | Arc | existing `arc`, but honour the click order of the three points as the arc's direction (see §4) |
| 5 | Curve | new — multi-point smooth curve, double-click to finish |

Plus a `Select` cursor above them (already exists).

Everything else — Midpoint, Polygon, Angle, Right angle, Equal/Parallel/Perpendicular marks, Label, Measure, Move, Erase, Constraint, Rotate, Sketch — is removed from the visible toolbox. (Underlying tool code can stay so we don't break other callers, but the toolbox UI in `GeometryToolbox.tsx` renders only the five above.)

Use the original icons from `GeometryToolbox.tsx` (including the old curve/spline icon you referred to as "the former icon").

## 3. Curve tool (new)

- Click adds a point; each click extends the curve; double-click (or Enter) finishes.
- Renders as a Catmull–Rom / smooth cubic path through the points.
- Points are real scene points — draggable, and the curve follows like Line does.
- Stored as a new `curve` object in the legacy scene: `{ id, kind: "curve", pointIds: string[], style, thickness, color }`.
- Register a static renderer in the legacy scene SVG and a hit region for selection.

## 4. Arc direction fix

Current arc uses 3 points as start/through/end but ignores click order for sweep direction. Change the arc renderer so the sweep goes start → through → end in the exact click order (compute the signed sweep from the mid point, pick the SVG `sweep-flag` accordingly). Applies to both interactive canvas and static render.

## 5. Circle = compass

- Circle slot triggers the compass flow: click centre, click radius point → full 360° circle.
- The radius line is a normal editable line (already true for compass).
- Interior counts as a selectable region for fill (already supported by the boundary hit region).

## 6. Right-hand Properties Panel is the only editor

- Any selection on the canvas (point, line, circle, arc, curve, or a label) publishes its editor via `useRegisterAssetEditor`, mirroring how the other assets already work.
- Deselect → panel clears.
- No floating popovers, no inline chips, no bottom toolbars.
- Every property that has a size (label font size, stroke thickness, arrow head size, mark size, distance-text size, fill opacity) gets a **Resize** slider in its panel section. Global default sizes stay, but each object can be resized individually.
- Panels to implement/refresh: Point (rename, colour, hide, label size), Line (style, arrows, equality/parallel marks, distance text + size), Circle (stroke, fill + opacity, radius line style, label size), Arc (stroke, arrows, label size), Curve (stroke style, thickness, label size), Label (text, font size).

## 7. Remove the diagram frame

- `GeometryDiagram.tsx` node view: drop the bordered inline container. The interactive canvas and static SVG render transparently, sized to their content, directly in the note flow.
- No background box, no border, no resize handles, no hover chrome around the diagram itself. The AI/Duplicate/Copy/Delete row you already have stays as the only floating control and only when selected.
- The lesson-note page itself is the board — the diagram is just ink on it.

## 8. Cleanup

- Delete `.lovable/plan.md` entries about the v2 rebuild.
- Typecheck; fix any dangling imports from removed files.

## Technical notes

- Files touched: `extensions/GeometryDiagram.tsx`, `geometry-editor/GeometryToolbox.tsx`, `geometry-editor/GeometryCanvas.tsx`, `geometry-editor/GeometryEditorPanel.tsx`, `geometry-editor/SelectionInspector.tsx`, `lib/geometry/scene.ts` (add `curve`), `lib/geometry/editor/sceneOps.ts` (curve ops, arc direction), plus new panel components under `geometry-editor/panels/` for the five tools.
- Legacy `scene` attribute stays as the single source of truth; no migration layer.
- No backend changes.

## Out of scope (ask again if you want them)

- Angle marks, equality/parallel marks, midpoint, polygon, measure, rotate, sketch-to-diagram. Everything not in the five-tool list is hidden but not deleted, so we can bring any back on request.
