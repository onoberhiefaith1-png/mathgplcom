## Technical detail

**Property** — `GeoLabel.rotation` (degrees) already exists in `src/lib/geometry/scene.ts` and is already serialized with the scene, so nothing changes in the schema or in saving/reopening. Values are normalized into `0…360` on read so existing negative angles keep rendering identically.

**Panel** — `LabelPanel` in `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`: the `Rotate` row becomes `Rotation`, moved directly below Size/Colour, with `min={0} max={360} step={1}` plus a small number input bound to the same `onPatch({ rotation })`. Both write live on change, so the canvas updates while dragging. Existing rows and handlers are left as-is.

**Rendering** — `src/components/lessonnotes/GeometryDiagram.tsx`, `case "label"`: the SVG transform pivots on the text's visual centre rather than the anchor, using the same width estimate the hit test uses (`text.length * fontSize * 0.58`) and a half-cap vertical shift. This one renderer is what the editor, the note, the floating page and the Smartboard all use, so no second renderer or extra pass is introduced.

**Hit testing / dragging** — `src/lib/geometry/editor/snap.ts`, the floating-text branch: when `rotation` is non-zero, rotate the incoming point by `−rotation` about the text centre before the box comparison. Drag logic itself is unchanged, since it moves `x`/`y` and does not read rotation.

Out of scope: the geometry objects themselves, other chip types (point labels, distances, angle values), and any panel restructuring.
