# 2D Geometry — exact click alignment and clean points

## The confirmed cause of the offset line

The drawing area draws its figure twice, in two different frames:

- The visible figure is drawn by the shared diagram renderer, which sizes itself from the shapes it contains.
- The invisible click/interaction layer on top sizes itself from the barrier region (the full width and height between the yellow lines).

When the region is larger than the figure — which it always is inside the barriers — the two layers use different internal scales and different centring. The click layer reads a coordinate in its own frame, the figure is painted in the other frame, so every new line lands shifted from the dots that were clicked, exactly the parallel offset in the screenshot. This is not a small rounding error, it is two coordinate systems.

## What will change

1. One authoritative coordinate frame. The drawing region computes the frame once (its own width, height and origin) and hands it to both the figure renderer and the click layer. The figure renderer stops deciding its own frame when it is inside a drawing region. No compensating shifts, no correction factors anywhere — the offset disappears because there is only one frame left.

2. Alignment holds under movement. Because both layers read the same frame from the live measured region, moving the lower barrier, scrolling, zooming, changing device width, or moving the figure down the page cannot introduce a shift. Existing drawings keep their exact coordinates when the barrier moves — only the visible window changes, never the geometry.

3. Green markers removed. The green dots and rings currently painted on clicked points, hovered snaps and helper points are removed from the normal drawing experience. While a line is still being drawn, a faint dashed rubber-band to the pointer remains (it is how you see where the line is going), and it disappears the moment the shape is finished.

4. Point toggle governs all visibility, default OFF. With Point OFF: no dots, no A/B/C letters, no markers of any kind — construction points still exist inside the geometry so lengths, angles, dragging and area still work. With Point ON: dots and letters appear, manual naming works as before, and existing figures are unchanged by flipping the toggle.

5. Automatic crossing points obey the toggle. Where two lines cross, the crossing point is still created for the mathematics, but with Point OFF it carries no dot and no letter. With Point ON it becomes visible and lettered. Turning the toggle on or off never moves a line or breaks a relationship.

6. Editing only inside 2D. While 2D is active the tools are live; outside it the figure is view-only and the barriers are hidden.

## Technical notes

- `GeometryCanvas` currently computes `W`/`H` from `computeSceneViewBox` widened by `regionW/regionH`, sets its own `<svg viewBox="0 0 W H">` at 1:1, but passes only `explicitWidth`/`explicitHeight` to `GeometryDiagram`, which recomputes `W`/`H` from the scene alone. Fix: give `GeometryDiagram` an explicit `viewW`/`viewH`/`minX`/`minY` frame override and pass the canvas frame into it; when supplied it must not recompute from `computeSceneViewBox` or `crop`.
- `toLogical` keeps its `xMidYMid meet` un-projection, now guaranteed correct because the renderer shares the same `W`/`H` and the same `translate(-minX,-minY)` and `PAD`.
- Remove the persistent `#10b981` markers for `pendingIds` and the hover snap ring; keep the dashed in-progress preview only.
- Gate visibility on `showPoints` from `GeometryModeContext` in one place: a scene-to-display step that marks non-explicit and `auto` points `hidden` with empty labels, applied to both the canvas and the static renderer. `ensureIntersectionPoints` keeps creating `auto: true` points; those are hidden by that same rule when the toggle is off, so no math changes.
- Node view renders the editable canvas only while 2D mode is on and the block is selected; otherwise the read-only diagram.

## Verification

- Typecheck plus the geometry and lesson-note test suites.
- A browser pass in a lesson note: draw a line between two widely separated points and confirm the line passes through both; repeat after moving the lower barrier and after scrolling; then Point ON/OFF; then two crossing lines with the toggle both ways; then a run through Select, Point, Line, Circle, Arc, Curve, Add Text, Add Distance, Add Angle, Add Area checking each lands where clicked.
