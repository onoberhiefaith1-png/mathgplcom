# Restore working geometry editor + unbounded diagram frame

## Step 1 — Revert (you do this)

Open History and revert to the AI message **just before** the "make lesson notes the background / notebook-wide overlay" change. That restores:

- Point / Line / Circle / Arc selection with glow highlight
- Right-hand Properties Panel that **splits** the layout (does not overlap the page)
- Auto-splitting Points on segments, angle editor for two segments, region shading
- Bounded diagram node inside a TipTap block

Do **not** keep any of these from the reverted-away versions:

- "Grow notebook" `+` button
- Lesson notes rendered as a background layer
- Notebook-wide transparent SVG overlay
- Text annotations on objects (we'll revisit later if you want)

<presentation-actions><presentation-open-history>View History</presentation-open-history></presentation-actions>

Ping me once the revert is done so I work from the correct base.

## Step 2 — What I'll change on top of the revert

Only two additions to the restored engine. Nothing else touched.

### 2a. Port the new Curve tool onto the reverted engine

The curve behaviour you confirmed as working:

- Click Curve tool → each click adds a control point
- Live preview draws the smooth spline as you move to the next point
- Double-click or Enter commits the curve
- Escape cancels
- Once committed, Select tool highlights and edits it like any other object (colour, thickness, dash, delete)

Implementation: replace the reverted `curve` tool handler in `GeometryCanvas.tsx` with the N-point Catmull-Rom version, and keep the existing `GeoCurve` renderer from `GeometryDiagram.tsx`. Add `curveBody` to `pickHit` in `snap.ts` and to the select-branch dispatch so it highlights and opens the right panel exactly like Line/Circle/Arc.

### 2b. Diagram frame auto-expands to full paper width and height

Inside the TipTap `geometryDiagram` node view:

- Width = paper's writable content width (same width the paragraph text uses)
- Height = remaining writable paper height from the diagram's insertion point to the paper's bottom margin, with a sensible minimum (e.g. 20 cm) so an empty diagram is still usable
- Recomputed via `ResizeObserver` on the paper element so switching paper size (A4/Letter) or zoom rescales the frame
- No visible frame border, no grow button — the diagram simply occupies the full writable area

Coordinate mapping stays 1 CSS px = 1 scene unit with `preserveAspectRatio="none"` on the SVG so clicks land exactly under the cursor at any paper size.

## Files I'll touch in Step 2

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — size the node view to full writable paper w/h; ResizeObserver hookup.
- `src/components/lessonnotes/GeometryDiagram.tsx` — `preserveAspectRatio="none"`; ensure viewBox tracks the sized container.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — N-point Curve tool (click-extend, dblclick/Enter commit, Esc cancel); ensure select branch sets `selectionKind` for `curveBody`.
- `src/lib/geometry/editor/snap.ts` — `curveBody` hit kind.
- `src/lib/geometry/editor/sceneOps.ts` — `addCurve(points[])`, `updateCurve`.
- `src/lib/geometry/scene.ts` — `GeoCurve` type (multi-point) if it isn't already in the reverted state.

## Verification

- Point/Line/Circle/Arc: click each in Select tool → glows and right panel shows its properties (split layout, not overlapping).
- Two segments sharing a point → Angle editor appears with reflex toggle.
- Point dropped on a segment → segment splits; deleting the point re-merges.
- Curve: click-click-click, double-click to commit; Select tool highlights the curve and edits colour/thickness.
- Insert an empty diagram on A4 → frame fills the writable paper width and extends to the bottom margin; clicks near all four edges place points exactly under the cursor.
