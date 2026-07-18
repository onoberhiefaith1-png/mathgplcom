## Goal
Unify text editing across the geometry editor, activate distance display + editing, allow "Add text" everywhere (including inside enclosed regions), and improve auto-behavior around intersections and split lines.

## Changes

### 1. Universal text editing (labels, distances, angles, "Add text")
Every piece of text on the canvas becomes editable with the same 4 controls: **rename**, **size**, **color**, **drag anywhere**. Text used as a label for a shape can also **rotate**.

- Consolidate a shared `TextStylePanel` in `SelectionInspector.tsx` covering: text content, font size slider, color picker, rotation (where applicable).
- Wire it into every text-bearing selection:
  - Point label (already exists — align controls)
  - Segment label + segment distance chip
  - Angle value chip (already partial — align controls)
  - Floating label (`GeoLabel`) with rotation
- Ensure all these chips are draggable on canvas (`GeometryCanvas`), reusing the existing drag handler pattern used by distance/angle offsets.

### 2. Line segment properties — activate Distance and add Text
In the segment inspector panel:
- Show line name in title (already done — `Segment · KL`).
- Solid / Dotted / Dashed (exists).
- **Distance**: text input. Setting a value renders the chip at the segment midpoint, draggable, resizable, recolorable. Clicking the chip on canvas opens the shared text-style panel.
- **Label**: independent name text (works like distance — draggable chip).
- **Add text**: button that inserts a new `GeoLabel` positioned near the segment midpoint. The label is draggable, resizable, recolorable, and rotatable.

### 3. Enclosed-region text
When a closed region is selected (or auto-detected from selected segments/full-circle/full-curve):
- Keep the existing "Shade enclosed area" (fill + opacity).
- Add "Add text" button — inserts a `GeoLabel` at the region centroid. Behaves like every other text chip (draggable, resizable, recolorable, rotatable).

### 4. Auto-point at every intersection
`intersections.ts` already handles segment×segment, segment×circle, segment×arc, circle×circle. Extend so **every** structure pair adds points where they cross:
- Add `circle × arc` and `arc × arc`.
- Add `segment × curve`, `circle × curve`, `arc × curve` (approximate curve via sampled polyline of the quadratic-Bezier / Catmull-Rom form).
- Run `ensureIntersectionPoints` on every commit (already runs after point drops — verify it also runs on shape adds and after drag-moves).

### 5. Auto-angle prompt when two lines share a point
Already: dropping a point on a segment splits it into two segments (AB with C in middle → AC + CB). Currently selecting the two child segments exposes the Angle editor.

New behavior: **when the multi-selection is exactly two segments that share a common endpoint**, the MultiPanel opens directly on the Angle editor (value input + up/down reflex toggle) as the primary action, instead of only listing it. Wording: "Angle at ⟨point⟩". Works identically for collinear (straight-line 180°) and non-collinear pairs. Any numeric value the teacher types is accepted (no clamping).

## Technical notes

Files touched:
- `src/lib/geometry/scene.ts` — no new fields needed (already have `fontSize`, `color`, `rotation`, `distanceFontSize`, `valueFontSize`, etc.).
- `src/lib/geometry/editor/sceneOps.ts` — extend `addFloatingLabel` to accept style opts; add `addLabelForSegment(segId)` and `addLabelForRegion(regionId)` helpers.
- `src/lib/geometry/editor/intersections.ts` — add arc×arc, circle×arc, and curve intersection sampling.
- `src/lib/geometry/editor/snap.ts` — ensure `pickHit` returns `label` for floating labels and `segmentDistance` for the distance chip (verify current bbox math accounts for custom `fontSize`).
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — introduce shared `TextStylePanel`; wire "Add text" buttons on Segment, Region, Circle, Arc, Curve panels; reroute two-adjacent-segments multi-select straight to Angle editor.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — make `GeoLabel` chips draggable and rotatable via a small handle; render rotation.
- `src/components/lessonnotes/GeometryDiagram.tsx` — apply rotation/fontSize/color to `GeoLabel` when rendering statically (already partial — confirm).

Out of scope (unchanged):
- Existing curve sub-segment highlighting.
- Existing fill/opacity mechanics.
- Panel width / docking behavior.
