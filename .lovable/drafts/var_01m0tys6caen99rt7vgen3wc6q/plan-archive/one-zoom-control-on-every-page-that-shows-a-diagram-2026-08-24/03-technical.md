## Technical notes

**New shared control** — `src/components/lessonnotes/geometry-editor/DiagramZoomControl.tsx`: presentational `−` / `NN%` / `+` pill (steps of 0.25, clamped 0.5–3, click percentage → 1). Uses semantic tokens only.

**New tiny hook** — `src/lib/geometry/useDiagramZoom.ts`: `useDiagramZoom(key)` returns `{ zoom, setZoom }`, persisted in `localStorage` under `diagram:zoom:<key>` (key = `diagramId`, else scene hash). No schema change.

**Uniform scaling stays where it already is** — `GeometryDiagram.tsx` already computes `displayW = baseW * zoomFactor`, `displayH = baseH * zoomFactor` from the same factor, keeps `viewBox` and `preserveAspectRatio="xMidYMid meet"`, and derives ink weight from the unzoomed scale. So no coordinates, no `viewBox`, and no label placement logic change — only the rendered box size. Aspect ratio is structurally preserved; there is no per-axis scale anywhere to add.

**Wiring, page by page**

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` (`GeometryDiagramView`): pass `zoom` from `useDiagramZoom(node.attrs.diagramId)` into the inline `GeometryDiagram`, and render `DiagramZoomControl` in the existing hover chrome row beside the "Geometry Properties" chip. Page zoom (`PageFrame`'s CSS `zoom`) continues to apply on top — the two compose visually, so no double-accounting in code.
- `geometry-editor/GeometryPropertiesWorkspace.tsx` / `GeometryWorkbench.tsx`: add an optional `zoom` prop threaded to the committed/preview render, plus the control in the workbench header. The live editing `GeometryCanvas` keeps its own auto-fit pointer maths (`rect.width / W`) untouched — the control scales the surrounding wrapper box, so `scale` there stays correct because it is recomputed from the measured rect.
- `geometry-editor/SmartboardPropertyTest.tsx`: `useDiagramZoom` + control in the top bar next to "Close test"; pass `zoom` to `GeometryDiagram`. The existing `overflow-auto` container handles panning when the figure exceeds the viewport; keep `mx-auto` so it stays centred when smaller.
- `smartboard/ReviewableBoardDiagram.tsx`: per-diagram factor multiplied with the incoming board `zoom` (`zoom * local`) before passing to `PresentationGeometryDiagram`; control rendered next to the existing Properties chip. `PresentationView.tsx` and `SolutionObjectView.tsx` keep passing board zoom unchanged.
- Full-screen relationship page reuses `SmartboardPropertyTest`'s layout, so it inherits the control.

**Out of scope / untouched**: `PageFrame` zoom UX, board zoom + carrier focal zoom in `PresentationView.tsx`, geometry tools, scene model, highlighting/pick bus, floating numbers, database.
