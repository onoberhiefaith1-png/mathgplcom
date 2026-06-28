
# MathGPL Geometry Editor — Implementation Plan

## Goal

Keep the Lesson Note Generator exactly as it is. Add a full **Geometry Editing System** that opens in a floating panel from a new **Diagram** toolbar button, edits the currently selected diagram in place, and works side-by-side with the existing AI Edit panel. Teacher never leaves the lesson note page.

## Foundations we reuse (no rewrites)

- `src/lib/geometry/scene.ts` — `GeometryScene` JSON is already the single source of truth (points, segments, lines, rays, circles, arcs, angles, polygons, labels). All new tools edit this JSON.
- `src/components/lessonnotes/GeometryDiagram.tsx` — SVG renderer.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — TipTap node + `openGeometryAiEdit`.
- `src/components/lessonnotes/GeometryAiPanel.tsx` + `supabase/functions/geometry-edit` — AI Edit stays unchanged and lives next to the new manual editor.
- Smartboard arc / polygon math in `src/lib/smartboard/` is reused for arcs and polygons.

## New surface

```text
Lesson Note Toolbar
  └─ Diagram ▾
       ├─ Insert blank diagram
       └─ Edit selected diagram   →  opens Geometry Editor Panel (floating, draggable)
                                     [AI Edit] button in the same panel opens the existing AI side panel
```

The Geometry Editor Panel is a floating, non-modal overlay anchored to the selected `geometryDiagram` node. The lesson note stays visible and scrollable behind it.

## Architecture

### 1. Scene model extensions (`src/lib/geometry/scene.ts`)
Additive only — existing fields keep working.
- `GeoSegment.length?: string` (e.g. `"5 cm"`, `"AB"`) for the Measurement tool.
- `GeoAngle.value` already exists; add `GeoAngle.locked?: boolean` for constraint-fixed angles.
- New marker kinds on `GeoSegment.marks`: `"parallel"|"double-parallel"|"triple-parallel"` for the Parallel tool.
- New object: `GeoConstructionArc` (compass arc; same shape as `GeoArc` with `kind:"construction"`).
- New optional `scene.style` block: `{ font?: string; strokeWidth?: number }` so the renderer stays themable.
- All additions are optional → existing scenes & the AI edge function keep validating.

### 2. Editor state (`src/lib/geometry/editor/`)
New folder, pure logic, no UI:
- `tools.ts` — `ToolId = "select"|"point"|"line"|"arc"|"circle"|"polygon"|"angle"|"label"|"measure"|"equalMark"|"parallel"|"perpendicular"|"rightAngle"|"midpoint"|"compass"|"move"|"erase"|"constraint"|"rotate"|"sketch"`.
- `sceneOps.ts` — pure functions that take a `GeometryScene` + intent and return the next scene (`addPoint`, `addSegmentChain`, `addArcThrough3`, `addCircleByRadius`, `closePolygon`, `markEqual`, `markParallel`, `markPerpendicular`, `placeRightAngle`, `midpointOf`, `eraseObject`, `moveObject`, `rotateScene`, `applyConstraint`). Every op returns `{ scene, addedIds, changedIds }` so we can show the same diff highlighting the AI panel already uses.
- `snap.ts` — Smart Snap: nearest point / midpoint / intersection / on-circle / on-line within a pixel threshold; returns a snap target + visual hint.
- `history.ts` — undo/redo stack scoped to the open editor session.
- `labels.ts` — auto-label generator (A, B, C…, skipping used letters).
- `constraints.ts` — `make-parallel`, `make-perpendicular`, `make-equal`, `make-tangent`, `make-isosceles`, `make-equilateral`, `make-circle` solvers operating on selected ids.

### 3. UI components (`src/components/lessonnotes/geometry-editor/`)
- `GeometryEditorPanel.tsx` — floating panel (draggable header, resize, close). Hosts the toolbar, the live canvas, the selection inspector, undo/redo, and an `AI Edit` button that defers to `openGeometryAiEdit` (already wired).
- `GeometryToolbar.tsx` — grouped tool buttons matching the 21 tools in the spec, with tooltips and keyboard shortcuts (P, L, A, C, G, N, T, M, E, ∥, ⟂, □, ·, ⊙, V, Del, K, R, S).
- `GeometryCanvas.tsx` — SVG canvas that renders the same scene as `GeometryDiagram` plus an interaction layer: hover snap dots, in-progress preview (rubber-band line/arc/circle), selection halos, drag handles.
- `SelectionInspector.tsx` — right-rail strip inside the panel for editing the selected object's label, length, angle value, dashed/solid, marks.
- `SketchLayer.tsx` — freehand capture (mouse/stylus/touch) used by the Convert Sketch tool.
- `useGeometryEditor.ts` — hook that wires scene + tool + history + snap and exposes `commit(nextScene)` which calls the TipTap node's `updateAttributes({ scene })`.

### 4. Tool behavior map (all driven by `sceneOps`)
1. **Point** — click → `addPoint` with auto label.
2. **Straight Line** — click points sequentially → `addSegmentChain`; Esc/Enter ends; reuses smartboard segment helpers.
3. **Arc (3-point)** — three clicks → `addArcThrough3` (uses smartboard arc math).
4. **Circle** — drag from center, or click-center-then-click-radius-point → `addCircleByRadius`.
5. **Polygon** — click points, Enter closes → `closePolygon` (auto segments + polygon object).
6. **Angle** — click arm1 → vertex → arm2 → `addAngleMark`, default `marker:"arc"`.
7. **Label** — click object, inline text input; writes `label`/`value`/`text`.
8. **Measurement** — click side/angle → editable text bound to `length` / `value`.
9. **Equal Mark** — click two sides (or two angles) → sets matching `marks` (single/double/triple cycles on repeat).
10. **Parallel** — click two lines → matching parallel arrows on both.
11. **Perpendicular** — click two intersecting lines → places right-angle square at intersection.
12. **Right Angle Marker** — click any angle → sets `marker:"right"`.
13. **Midpoint** — click segment → new point at midpoint with auto label `M`.
14. **Compass / Construction Arc** — click center, click radius point → dashed construction arc.
15. **Move** — drag points (dependent geometry follows because everything references point ids).
16. **Eraser** — click object → `eraseObject` cascading only to orphan dependents.
17. **Constraint** — multi-select + choose constraint → `constraints.ts` solver.
18. **Convert Sketch** — `SketchLayer` records strokes, posts to a new edge function `geometry-sketch` that returns a `GeometryScene`; teacher gets the same Apply / Regenerate preview as AI Edit.
19. **Rotate** — rotate selected ids or whole scene; renderer keeps labels upright (labels are rendered as separate text nodes with their own transform reset).
20. **Smart Snap** — global behavior, threshold ~8px, visualized as a small ring.
21. **AI Edit Integration** — unchanged: panel exposes the existing AI Edit button; manual + AI edits commit to the same scene; AI preview/apply flow stays as-is.

### 5. Backend (Lovable Cloud edge functions)
- **No change** to `geometry-edit`.
- **New** `supabase/functions/geometry-sketch/index.ts` for Convert Sketch:
  - Input: `{ strokes: Array<{x:number,y:number}[]>, bounds, topic? }`.
  - Uses Lovable AI Gateway (`google/gemini-2.5-flash`, vision-capable) with a rasterized PNG of the strokes + a system prompt reusing `GEOMETRY_SCENE_SCHEMA` from `notebook-ai/geometryStandard.ts`.
  - Output: `{ scene: GeometryScene }`, same shape as `geometry-edit` so the panel can reuse the preview/apply UI.

### 6. TipTap integration
- Extend the `geometryDiagram` NodeView with an extra hover action **Edit** (pencil icon), beside the existing **AI Edit** and **Delete**.
- `Edit` dispatches a new `geometry-editor:open` window event (mirror of `openGeometryAiEdit`). `DocumentEditor` listens and mounts `GeometryEditorPanel` for that node, passing `onApply: (scene) => updateAttributes({ scene })`.
- Toolbar gets a `Diagram` dropdown: **Insert blank diagram** (inserts an empty `geometryDiagram` node + opens editor) and **Edit selected diagram** (enabled when a `geometryDiagram` node is selected).

### 7. Tests (`src/test/`)
- `geometryScene.ops.test.ts` — sceneOps for each tool: add point, chain segments, polygon close, arc-through-3, circle by radius, midpoint, equal/parallel/perpendicular marks, erase cascades.
- `geometryConstraints.test.ts` — make-parallel, make-perpendicular, make-isosceles, make-equilateral, make-tangent.
- `geometrySnap.test.ts` — snap-to-point/midpoint/intersection thresholds.

## Out of scope (kept for later)
- Theorem scaffolding & relationship highlighting (spec lists these as future Smart Diagram features).
- Multi-diagram linking.
- Persistent per-teacher tool preferences.

## File touch list
New:
- `src/lib/geometry/editor/{tools,sceneOps,snap,history,labels,constraints}.ts`
- `src/components/lessonnotes/geometry-editor/{GeometryEditorPanel,GeometryToolbar,GeometryCanvas,SelectionInspector,SketchLayer,useGeometryEditor}.tsx`
- `supabase/functions/geometry-sketch/index.ts`
- `src/test/geometryScene.ops.test.ts`, `geometryConstraints.test.ts`, `geometrySnap.test.ts`

Edited (additive):
- `src/lib/geometry/scene.ts` — optional fields only.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — add **Edit** action + `openGeometryEditor` event helper.
- `src/components/lessonnotes/DocumentEditor.tsx` — toolbar **Diagram** menu, mount `GeometryEditorPanel` on event.

Unchanged: `GeometryDiagram.tsx` renderer, `GeometryAiPanel.tsx`, `geometry-edit` function, lesson-note generation pipeline.
