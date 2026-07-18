# Geometry Editor — Curve, Auto-Intersections, and Frameless Drawing

Three focused changes.

## 1. Curve tool — match the Graph's behavior

Today's geometry Curve is a multi-click Catmull-Rom smoothing that finishes on double-click. The teacher wants it to behave like the graph's curve: **exactly 3 clicks** — start, control (middle), end — producing a smooth curved line between the two endpoints, with the middle click bending the curve. Same interaction shape as the existing Arc tool, but rendered as a quadratic Bézier instead of a circular arc.

Changes:
- `src/lib/geometry/scene.ts` — extend `GeoCurve` with `a`, `mid`, `b` (three point IDs). Keep `points` as fallback for legacy data.
- `src/lib/geometry/editor/sceneOps.ts` — `addCurve` now takes exactly 3 point IDs and stores them as `{a, mid, b}`.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — Curve tool collects 3 clicks then commits (mirrors the `arc` case), removes the double-click-to-finish path for Curve.
- `src/components/lessonnotes/GeometryDiagram.tsx` — render Curve as `M a Q mid b` quadratic Bézier; halo path matches.

## 2. Auto-insert points at every intersection

Whenever any two structures cross, drop a point at that crossing automatically. Teacher can delete unwanted ones (existing behavior). This makes closed-region shading much easier to trigger.

New module `src/lib/geometry/editor/intersections.ts`:
- Pairwise intersection math for the pairs we actually have: segment×segment, segment×circle, segment×arc, segment×curve, circle×circle, circle×arc, circle×curve, arc×arc, arc×curve, curve×curve.
- Returns a list of `{x, y, onA, onB}` hits with the two host object IDs.

New `ensureIntersectionPoints(scene)` in the same file:
- Walks all object pairs, finds crossings, dedupes against existing points (within snap radius), and for each new crossing:
  - creates a `GeoPoint` with `auto: true` and a fresh default label,
  - splits any segment/curve it lies on using existing `sceneOps` splitting helpers so the crossing point becomes a real vertex (as we already do when a Point is dropped on a segment),
  - inherits styles onto the split children.
- Idempotent: safe to run on every scene commit.

Wiring:
- `src/lib/geometry/scene.ts` — add optional `auto?: boolean` to `GeoPoint`.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — after `normalizeScene`, run `ensureIntersectionPoints`. Run it again inside `apply`/`commit` so freshly-drawn structures immediately gain their intersections.
- Erase behavior for `auto` points: same as today — deleting an auto-point can re-merge the split segments (existing `eraseObject` logic).

Circles/arcs/curves aren't split by the intersection point today (only segments are). We'll extend the "split" path for curves (split a `GeoCurve` at parameter `t` into two curves) so shading enclosed regions works when a curve is one side of the boundary. Arcs and circles remain a single object; the point just sits on them (the region walker in `regions.ts` already handles arc/circle boundaries via endpoint incidence, which is enough now that the intersections become real vertices).

## 3. Remove the diagram frame — whole lesson note is the drawing paper

Currently every `GeometryDiagram` node renders an inline-block SVG sized to `scene.bounds`. Anything drawn outside those bounds is clipped, and the node sits in normal document flow so it can't visually overlap the paragraphs above/below.

New model: a **single page-wide drawing overlay** per lesson note.

- `src/components/lessonnotes/DocumentEditor.tsx` — wrap the notebook body in a `position: relative` container and mount one `<GeometryOverlay/>` absolutely positioned over it (`inset: 0`, `pointer-events: none` by default, `pointer-events: auto` when Geometry mode is active).
- New `src/components/lessonnotes/geometry-editor/GeometryOverlay.tsx`:
  - Collects every `geometryDiagram` node in the current document via TipTap (`editor.state.doc.descendants`) and merges their scenes into one virtual scene, offsetting each by the DOM position of its anchor node so shapes stay attached to the paragraph they were created next to.
  - Renders one full-height SVG (width = notebook column width, height = notebook scroll height) with no border, no background — pure ink over the paper.
  - Routes pointer events to the active node's editor (the one currently `selected` in TipTap), so drawing still commits to that node's `scene`.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx`:
  - Node view becomes a **zero-height anchor**: renders nothing visible itself, just registers its position and scene with the overlay via context.
  - Selected state still opens the toolbox/inspector; live drawing is done on the overlay canvas.
- `scene.bounds` is no longer a clip. `GeometryDiagram.tsx` (static renderer) drops the SVG `width/height` constraints and renders into whatever viewport the overlay gives it. Individual scenes can now extend beyond their historical bounds; bounds auto-grow as points are added.

Net effect: the teacher can draw from the top of the page to the bottom, across paragraphs and other diagrams, and scroll to see the full shape. Existing diagrams keep working because each still owns its own scene — the overlay just paints them on the same infinite canvas.

## Verification

- Curve tool: 3 clicks produce a smooth curve; the middle click controls the bend. Selecting the curve still opens the segment-style inspector.
- Drop a circle across an existing segment: points appear at both crossings, segment dissects into three parts, each independently editable and highlightable.
- Draw a line starting in Example 5 and ending in Example 4: the ink extends across paragraphs; scrolling reveals both ends; no frame is visible.

## Out of scope

No changes to the toolbox, inspector, angle editor, or distance chips — those already work per the previous turn.
