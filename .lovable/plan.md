# Geometry overlay — fix click accuracy, restore editing, add text annotations & page grow

Four focused changes on top of the notebook-wide overlay we shipped last turn.

## 1. Click position drift (points land below the cursor)

**Cause.** In `GeometryCanvas.tsx`, `toLogical` maps pointer coords using the SVG's `getBoundingClientRect()` against a viewBox of `scene.bounds.width × height + 2·PAD`. The overlay `<div>` is sized with `overlayWidth/overlayHeight` (from `NotebookGeometryOverlay`) which is the max of the stored scene bounds and the current paper size + 48. When these two values disagree (e.g. paper is taller than the stored bounds, or the SVG uses `preserveAspectRatio="xMidYMid meet"` and letterboxes), the rendered SVG doesn't fill the interaction div — so the click at `y=Y` on screen maps to a lower `y` in scene space, and every new point lands below the cursor.

**Fix.**
- Make `NotebookGeometryOverlay` pass the exact pixel size it renders at into `useGeometryEditor` as `scene.bounds`, so SVG viewBox = overlay size = paper size. No independent `overlayWidth` calc.
- In `GeometryDiagram.tsx` / `GeometryCanvas.tsx`, set `preserveAspectRatio="none"` on the interaction SVG (or ensure width/height CSS = `100%` with matching viewBox so 1 CSS px = 1 logical unit).
- Verify `toLogical` by test-clicking near the top and bottom edges; the created point should sit under the cursor within 1 px.

## 2. Editing feature dead — selection no longer opens the right panel

**Cause.** `useRegisterAssetEditor(active=mode, id="notebook-geometry", ...)` in `NotebookGeometryOverlay` only registers while diagram mode is on. When the user picks the Select tool and clicks a shape, `selectedIds` updates but the right-panel title/body are memoised on `[selectedObjects, selectionKind]` — and `selectionKind` is only set by the `pickHit` branches in `onPointerDown` for the `select` case. For circles/arcs/curves and for point labels, the current code doesn't set `selectionKind`, so the `SelectionInspector` falls back to the empty "Click a point…" state.

**Fix.**
- In `GeometryCanvas.onPointerDown` (select branch), always call `setSelectionKind(hit.kind)` — including `pointDot`, `pointLabel`, `segmentBody`, `circleBody`, `arcBody`, `curveBody`, `angleValue`, `segmentDistance`.
- `SelectionInspector` gets a dispatch for every `hit.kind` currently produced by `pickHit`, so `Circle`, `Arc`, `Curve` render their properties (color, thickness, dash, size, delete) the same way segments do today.
- Right-panel title uses `selected.type` + label (e.g. "Line DE", "Circle O", "Arc BCD", "Curve").
- Confirm that clicking a letter label still opens the label editor (size/colour/rename) — this path exists but is currently short-circuited when the tool isn't `select`.

## 3. Text annotations on any object (+ enclosed regions) with rotation

**Data model.** Add an optional `annotations: GeoAnnotation[]` array on `GeoSegment`, `GeoCircle`, `GeoArc`, `GeoCurve`, `GeoPoint`, and `GeoRegion` in `src/lib/geometry/scene.ts`:

```ts
interface GeoAnnotation {
  id: string;
  text: string;
  offset: { dx: number; dy: number };   // draggable
  rotation: number;                     // degrees, 0/90/180/270 or free
  fontSize?: number;
  color?: string;
}
```

**UI.**
- `SelectionInspector` gets a new "Text" section for every selectable kind: an input for the string, a font-size slider, colour picker, and a rotation slider (0–360°) with quick 0/90/180/270 buttons.
- Rendering in `GeometryDiagram.tsx`: each annotation is a `<text>` positioned at the object's anchor (segment midpoint, circle centre, arc midpoint, curve midpoint, point position, region centroid) + `offset`, with `transform="rotate(rotation, ax, ay)"`.
- Annotations are draggable in `GeometryCanvas` via the same label-drag pattern already used for `segmentDistance`.
- Region annotations become the primary way to label Venn regions ("X ∪ Y", "Geography").

## 4. "Grow notebook" button at the bottom

Below the paper add a small `+` button (icon in a bordered pill) rendered by `DocumentEditor`. Clicking it appends `~200px` of blank paper by inserting a paragraph with a spacer class (or bumping the paper's min-height via CSS variable stored in notebook meta). The overlay `ResizeObserver` already reflows to the new paper height, so drawings continue seamlessly into the new area.

## Files to change

- `src/lib/geometry/scene.ts` — add `annotations` field + type.
- `src/components/lessonnotes/GeometryDiagram.tsx` — render annotations, use `preserveAspectRatio="none"`.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — always set `selectionKind` on hit; annotation drag; correct coordinate mapping.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — panels for Circle/Arc/Curve/Region; universal Text-annotation section with rotation.
- `src/lib/geometry/editor/sceneOps.ts` — helpers: `addAnnotation`, `updateAnnotation`, `moveAnnotation`.
- `src/lib/geometry/editor/snap.ts` — hit kind `annotation` so annotations are clickable/draggable.
- `src/components/lessonnotes/DocumentEditor.tsx` — bounds sync with paper size (fix #1), grow-notebook `+` button.

## Verification

- Click at four corners of the paper with the Point tool → dot lands under the cursor (screenshot).
- Draw a line, click it with Select → right panel shows "Line …" with dash/color/arrow controls and a Text section.
- Add "X ∪ Y" to a closed region, rotate 90°, drag to reposition → renders and persists after reload.
- Click the `+` at the bottom → paper grows, existing drawings unaffected, new points can be placed in the new region.
