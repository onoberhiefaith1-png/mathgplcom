## Goals

1. Delete the "Grow notebook" button and make the notebook grow infinitely as the user scrolls / draws near the bottom.
2. Restore the full editing behaviour for Point, Line, Circle, Arc, Curve — clicking any of them selects it, glows it, and opens its settings in the right-hand panel.
3. Fix the "click drift" bug: the point (or any created object) must land exactly under the pointer, not offset below.
4. Add text/labels to any object via a click — Point, Line, Circle, Arc, Curve, and Region.

## What to change

### 1. Remove Grow notebook, add infinite scroll growth
File: `src/components/lessonnotes/DocumentEditor.tsx`
- Delete the `growNotebook` function and the `<button>` that renders the "+ Grow notebook" chip (lines ~1830–1874).
- In the `NotebookGeometryOverlay` effect, add an auto-grow mechanism:
  - Watch page scroll on the notebook scroll container.
  - When the user scrolls within ~200px of the bottom of `paperLayerRef`, bump `paperLayerRef.current.style.minHeight` by +600px.
  - Same trigger fires when a pointer-down inside the geometry canvas lands within ~120px of the current bottom edge (so drawing near the edge extends the paper immediately).
- The existing `ResizeObserver` already propagates the new height into `paperSize` → `overlayHeight` → SVG viewport, so the drawing surface follows automatically.

### 2. Fix click drift on Point / Line / Circle / Arc / Curve
File: `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx`
- The SVG currently declares both `width="100%"` and an inline `style={{ width: W, height: H }}` with `preserveAspectRatio="none"`. The style wins and stretches the SVG to fixed pixels, but `getBoundingClientRect()` in `toLogical` reads the actual rendered box, which under CSS zoom / DPR scaling produces a mismatched ratio → objects render below the click point.
- Fix by:
  - Dropping the pixel `width/height` from the inline `style` so the SVG really fills 100% of the overlay div (which is already sized to `overlayWidth × overlayHeight`).
  - Keeping `viewBox="0 0 W H"` and `preserveAspectRatio="none"` so `toLogical`'s ratio math (`(clientX-rect.left)/rect.width * W`) is exact regardless of zoom.
  - Same fix on the background `<GeometryDiagram>` layer (`explicitWidth/Height` in px is fine — it's the interactive SVG that needs the correction).
- Verify by clicking with the Point tool at four corners of the overlay — the dot must render exactly at the cursor.

### 3. Restore editing / selection for all five tools
Files: `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx`, `src/lib/geometry/editor/snap.ts`, `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`
- `pickHit` in `snap.ts` already returns hits for point/segment/circle/arc/curve/region — audit it and ensure every object type in `scene.objects` has a corresponding hit branch, with a `hit` slack of 8 logical units.
- In `onPointerDown` (select tool), keep the toggle-select behaviour but make sure:
  - `selectionKind` is set from `hit.kind` for every kind (`point`, `segment`, `circle`, `arc`, `curve`, `region`, `polygon`, `angle`, `annotation`).
  - When a hit happens the canvas does NOT fall through to the "create new object" branch of the active tool. Guard each tool's create branch with `if (hit) { /* select instead */ return; }` — this restores the "click on existing = select, click on empty = draw" behaviour.
- `SelectionInspector` must render an editor for every `kind`. Confirm sections exist for: point, segment, circle, arc, curve, region, angle, annotation. Add any missing curve/arc panels (label, stroke, arrows, marks, distance, region shading) matching the earlier working version.
- Highlight/glow: the current renderer already tints via `colourOf`; extend it to add a subtle drop-shadow / thicker stroke when the object's id is in `selectedIds`. Applies to all five primitives + regions.

### 4. Universal "add text" via click
Files: `src/lib/geometry/editor/sceneOps.ts`, `src/lib/geometry/editor/annotations.ts`, `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`, `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx`
- The `GeoAnnotation` model already exists on every object.
- In `SelectionInspector`, add an "Add label" button in every kind's section that calls `addAnnotation(scene, selectedId)` (creates an empty annotation anchored to the object's natural anchor: point position, segment midpoint, circle centre, arc midpoint, curve midpoint, region centroid).
- After adding, the canvas opens the inline text editor (`setInlineEdit({ kind: "annotationText", ... })`) so the teacher types immediately.
- Annotations remain draggable (already wired via `labelDrag.kind === "annotation"`) and rotatable via the inspector (0/90/180/270 quick-buttons and a free numeric input).
- Confirm annotation hit-testing works so clicking an existing annotation re-selects it for further edit / move / rotate.

## Verification checklist

- Clicking Point tool anywhere on the notebook drops the dot exactly under the cursor at 100% and 125% browser zoom.
- Drawing a Line, Circle, Arc, Curve — then clicking on it with Select — glows it and opens its settings on the right.
- Right panel shows the object type as title and its fields (label, stroke, arrows, marks, distance / radius / arc value / smoothness).
- "Add label" button on every kind creates a draggable, rotatable text pinned to the object.
- Scrolling to the bottom of the notebook extends the drawing paper without any button; existing content stays fixed.
- No "+ Grow notebook" button anywhere in the DOM.

## Out of scope

- No changes to the toolbox, curve engine, auto-intersection, or region-shading maths — all already work.
- Lesson-note text remains an inline editor above the diagram overlay; not touching the "background mode" behaviour beyond what's needed to keep drawing unbounded.
