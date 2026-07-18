## Goals

Four focused fixes to the geometry editor, keeping Point / Line / Circle / Arc / Curve behavior intact.

---

### 1. Enclosed-region detection (shape-agnostic)

Bring back the "Region / Fill" behavior, but generalize it so **any** closed loop qualifies — triangle, square, hexagon, circle, or a mixed loop of segments + arcs + curves.

- Extend `src/lib/geometry/editor/regions.ts`:
  - Keep the existing segment-cycle detector.
  - Add a **single-object closure** rule: one selected `circle`, or one closed `arc` (from = to), or a closed `curve` (first point = last point) counts as an enclosed region on its own.
  - Add a **mixed-boundary** detector that treats arcs and curves as edges between their endpoint points, so a loop like `segment → arc → segment` still resolves to a cycle.
- In `SelectionInspector.tsx`, when the current selection resolves to a region, show a **Region** panel: fill color, fill opacity, and clear-fill.
- Store fills on a new `regions` array in the scene (id + ordered boundary + style) so re-selecting the same loop re-opens the same region.
- Render regions in `GeometryDiagram.tsx` beneath strokes as an SVG `<path>` built from the boundary (line-to for segments, arc-to for arcs, cubic for curves).

### 2. "Add text" available on every selection

Every inspector panel (Point, Line/Segment, Arc, Circle, Curve, Label, Angle, Region) gets an **Add text** action.

- New scene object `GeoText { id, x, y, text, rotation, size, color, anchorId? }`. When added from a selection, anchor near that object's centroid; freely draggable afterward.
- Inspector controls: text value, size, color, and a **rotation** slider (−180° … 180°). Renders via `<text transform="rotate(...)">` in `GeometryDiagram.tsx`.
- Reuses the existing draggable-label machinery in `GeometryCanvas.tsx` (same drag handler as point labels) so the text can be moved anywhere on the notebook.

### 3. Curve highlight obeys the "max 2 points" rule

Today clicking a curve highlights the whole spline. Fix so a click only glows the segment between the two nearest anchor points.

- In `src/lib/geometry/editor/snap.ts` `pickHit`, when the hit is on a `curve`, return the **anchor-pair index** (i, i+1) alongside the curve id.
- In `sceneOps.ts`, extend the selection model to allow `{ curveId, segmentIndex }` selections (analogous to how a dissected line already works for segments).
- In `GeometryCanvas.tsx` halo rendering, draw the glow only over that sub-span of the Catmull-Rom path (sample points between anchors i and i+1). Circles and closed arcs with zero anchors continue to glow whole (0-point rule). Selecting a second sub-span on the same or different curve keeps working like segment multi-select.
- Inspector title reflects the sub-span (e.g. "Curve B–C").

### 4. Right-hand properties panel = 10% width, non-overlapping

Panel should share a boundary with the page and shrink the notebook area instead of floating over it.

- In the layout wrapper that hosts the notebook + inspector (currently in `DocumentEditor.tsx` / the `useRegisterAssetEditor` host), switch to a flex row:
  - Notebook column: `flex: 1 1 auto`, `min-width: 0`.
  - Inspector column: `flex: 0 0 10vw`, `min-width: 220px`, `border-left`, sticky.
- Remove the absolute/overlay positioning and any `z-index` that made it float.
- Panel is only mounted when a geometry (or other asset) selection exists; when empty, the notebook reclaims the full width.

---

### Technical notes

- Scene schema additions: `regions: GeoRegion[]`, `texts: GeoText[]`, optional `subIndex` on selections.
- Migration: existing scenes without these arrays default to `[]`; no data loss.
- All new inspector fields go through the existing `patchObject` / `commit` pipeline so undo/redo keeps working.
- No changes to Point / Line / Circle / Arc drawing tools themselves.

---

### Out of scope

- Any changes to Bar/Pie/Histogram charts or the math editor.
- New geometry tools beyond the existing five.
