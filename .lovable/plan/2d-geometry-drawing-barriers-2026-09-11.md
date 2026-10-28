# 2D Geometry — Drawing Barriers

Stabilise the 2D workspace by giving it a defined drawing region first. The geometry tools themselves are not redesigned.

## What the teacher will see

1. Pressing **Diagram → 2D** immediately opens a drawing region on the page at the current writing position:
   - a fixed horizontal line across the full page width above it (upper barrier),
   - a horizontal line across the full page width below it (lower barrier),
   - the notebook's left and right page edges close the region.
2. The lower barrier carries an up/down arrow handle. Dragging it down enlarges the drawing area; dragging it up shrinks it. It can never pass above the upper barrier (a minimum region height is enforced).
3. Any lesson content already below the region — text, questions, exercises, tests — is pushed down as the lower barrier moves down, and comes back up when it is moved up. Nothing is ever covered.
4. Inside the region all existing 2D tools work exactly as they do now: points, lines, angles, circles/arcs/curves, shapes, measurements, labels, construction tools, calculations and properties. No new restrictions inside the region.
5. Leaving 2D mode removes both barrier lines and the arrow handle and returns the page to its normal look. The barriers never print, never save as lesson content, and never appear in other modes.

```text
|                         |
|=========================|  <- fixed upper barrier
|     2D DRAWING AREA     |
|=========================|  <- movable lower barrier (arrow handle)
|   existing lesson text  |
```

## Technical notes

- The region is the existing in-flow `geometryDiagram` block (`src/components/lessonnotes/extensions/GeometryDiagram.tsx`). It already reserves real document height via the `height` attribute, so pushing following content down needs no new layout system — only the barrier chrome and a clamped drag.
- Activating 2D in `DocumentEditor.tsx` (the `2D` button, currently only `setGeometryMode(true)`) also ensures a region exists: reuse the block owned by the current question if there is one, otherwise insert one at the caret via the existing `insertGeometryAtPoint` path, then select it so its live canvas mounts.
- Barrier chrome is rendered inside the node view, only while `useGeometryMode().mode` is true and this block is the active frame: two full-bleed 1px rules (top pinned, bottom at the region edge) plus the arrow handle on the bottom rule. `contentEditable={false}`, `data-*` marked, excluded from DOCX/print/presentation output — purely mode UI.
- Replace the current bottom-edge `startResize` with the handle drag: same pointer flow, clamped to `Math.max(MIN_REGION, ...)`, live `dragHeight` preview, commit to `height` on release so the reflow of following content is a normal document reflow.
- The drawing canvas fills the region and is clipped to it, so strokes cannot land outside the barriers; tool behaviour, scene data, IDs, labels and measurements are untouched.
- Verification: typecheck, existing geometry/diagram-in-flow tests, plus a check that leaving 2D mode leaves no barrier nodes in the saved document.
