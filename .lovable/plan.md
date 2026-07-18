## Problem

When you click on the canvas to draw (arc, circle, point, etc.), the shape lands in a different position than where you clicked, and highlight halos land off the shape. Two things are causing the drift, and both must be fixed together.

### Cause 1 — SVG letterboxing is ignored

The interaction SVG in `GeometryCanvas.tsx` renders with `preserveAspectRatio="xMidYMid meet"` (the default). When the container's aspect ratio doesn't match the viewBox, the browser adds equal padding to the short axis and centres the content. But `toLogical()` (lines 39–47) maps the pointer linearly across the *whole* bounding rect:

```ts
x: ((e.clientX - rect.left) / rect.width) * W - PAD
```

That formula is only correct when the SVG fills its box edge-to-edge. In every other case, clicks near the edges convert to logical coordinates that are shifted, so the point you drop appears offset.

### Cause 2 — Interaction viewBox ≠ display viewBox

`GeometryDiagram.tsx` (lines 59–65, 107) grows its viewBox to fit anything past `scene.bounds` and applies `translate(-minX, -minY)` so nothing gets clipped. `GeometryCanvas.tsx` (lines 36–37, 482) uses the un-grown `scene.bounds` for its own viewBox and applies no matching translate. Once anything is drawn outside the original bounds — an arc dragged past the edge, a curve extended by "Expand" — the two SVGs no longer share a coordinate system. What you see in the diagram is shifted from where the interaction layer thinks it is, so highlighting and further clicks land on the wrong spot.

## Fix

Make the interaction layer share the diagram's exact coordinate system in every frame.

1. **Single source of truth for extent.** Export the extent math (`minX/minY/maxX/maxY → W/H`) from `GeometryDiagram.tsx` as a small helper (`computeSceneViewBox(scene, pad)`). Both `GeometryDiagram` and `GeometryCanvas` call it, so they always agree on `viewBox`, `W`, `H`, and the `translate(-minX, -minY)` offset.

2. **Fix `toLogical` to respect `preserveAspectRatio="xMidYMid meet"`.** Replace the linear formula in `GeometryCanvas.tsx` with the correct un-projection:
   - Compute `scale = min(rect.width / W, rect.height / H)`.
   - Compute the letterbox offset: `offsetX = (rect.width - W * scale) / 2`, same for Y.
   - Logical `x = (clientX - rect.left - offsetX) / scale - PAD + minX`, likewise for Y.
   
   This unifies letterboxing correction (Cause 1) and the extent translate (Cause 2) into one mapping. Every click resolves to the exact logical point under the cursor, regardless of container aspect or how far shapes extend past `scene.bounds`.

3. **Match viewBox and translate on the interaction SVG.** In `GeometryCanvas.tsx`, use the shared extent to set `viewBox={`0 0 ${W} ${H}`}` and wrap the interaction contents (halos, hover ring, ghost previews) in the same `<g transform={`translate(${-minX}, ${-minY})`}>` the diagram uses. Halos, snap targets and ghost strokes will then sit exactly on the rendered shapes.

4. **Apply the same fix to `SmartOverlay.tsx`** (identical linear-map bug on lines 22–29) so smart-part hover/selection also lands where the user clicks.

### Files touched

- `src/components/lessonnotes/GeometryDiagram.tsx` — extract `computeSceneViewBox` helper; keep rendering identical.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — use shared helper, rewrite `toLogical`, wrap interaction layer in matching translate.
- `src/components/lessonnotes/geometry-editor/SmartOverlay.tsx` — same `toLogical` correction.

### Verification

- Draw an arc/circle/point at multiple positions (top-left, centre, far-right past `scene.bounds`). Confirm the shape appears exactly under the cursor at both endpoints.
- Resize the notebook column so the container aspect ratio differs from the viewBox; re-run the click test near the edges.
- Click a drawn arc — the blue selection halo should sit on the arc, not offset.
