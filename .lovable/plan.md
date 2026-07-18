## Goals

1. **Curve = continuous, N-point** (like the Line tool but smooth). Not 3 fixed points.
2. **Diagrams are notebook-wide overlays**, not tied to one section. They can extend across / overlap sections and existing text; new sections must slot in *underneath* the drawing.

---

## 1. Continuous Curve tool

The current curve is a fixed 3-point quadratic Bezier (start / bend / end). Rebuild it like Line:

- Each click adds a point and immediately extends the curve to the cursor (rubber-band preview to the hovered position).
- Double-click, Enter, or Escape commits the curve with all collected points.
- Right-click / Escape while pending cancels.
- Render as a smooth Catmull-Rom (or cubic-Bezier) spline through every anchor point, so 2 points looks like a gentle arc, 3 → S-curve, N → smooth continuous curve.
- Every anchor is a normal `GeoPoint` (draggable, deletable, auto-splits at intersections, participates in region cycles). Deleting an interior anchor just reshapes the spline.

Files to touch (technical):
- `src/lib/geometry/scene.ts` — restore `GeoCurve.points: GeoId[]` as the primary form; keep legacy `a/mid/b` read-support only.
- `src/lib/geometry/editor/sceneOps.ts` — `addCurve` takes `GeoId[]` of any length ≥ 2; `appendCurvePoint` helper.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — curve case mirrors Line: accumulate points, live preview from last anchor to cursor, commit on dbl-click / Enter / Esc.
- `src/components/lessonnotes/GeometryDiagram.tsx` — render `points[]` as a Catmull-Rom path.
- `src/lib/geometry/editor/snap.ts` — hit-test walks the sampled polyline (already does; just needs the N-point form).
- `src/lib/geometry/editor/intersections.ts` — sample the spline for curve×segment / curve×circle intersections.

---

## 2. Notebook-wide drawing surface

Today each Geometry diagram is a TipTap **block node** rendered inline inside one section — that's why it feels "stuck" in a session and why the "+" section button appears cramped next to it. The user wants the diagram to behave like a transparency laid over the whole notebook.

Change the geometry node from an inline block to a **floating overlay pinned to the notebook page**:

- New wrapper `GeometryOverlayLayer` mounted once per notebook page (in the notebook renderer), absolutely positioned, `pointer-events: none` by default, `pointer-events: auto` on the actual ink / handles.
- Each geometry node becomes a *zero-height anchor* in the document flow (so section order/serialization is preserved) plus a record on the overlay layer with `{ anchorTop, sceneId, scene }`.
- The overlay SVG sizes to the full notebook column width and grows vertically to `max(anchor + sceneHeight, notebookHeight)`. `overflow: visible` so drawings can extend past their anchor in both directions.
- Section content (`+ New section`, text blocks, other assets) renders **below** the overlay in z-order but the overlay ignores pointer events except on ink → clicks pass through to text, so typing / adding sections underneath a drawing keeps working.
- When the user starts a new section, it inserts at its normal document position; because the overlay is above but click-through, the section visually appears *underneath* any drawing that crosses its area — exactly what the user described.
- Clicking a geometry tool arms the whole notebook: the very next click anywhere on the page drops the point on the overlay, regardless of which section the cursor is over. Selection/edit stays scoped to the diagram whose ink was hit.

Files to touch (technical):
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — node becomes a thin anchor; renders nothing visible itself, just registers `{id, top, scene}` into a context.
- New `src/components/lessonnotes/geometry-editor/GeometryOverlayLayer.tsx` — the shared SVG overlay + tool arming + hit dispatch.
- New `src/components/lessonnotes/geometry-editor/GeometryOverlayContext.tsx` — registry of active diagrams on the current page.
- Notebook page renderer (wherever the editor is mounted, e.g. `NotebookEditorPage.tsx` / the lesson-note view) — mount `GeometryOverlayLayer` as a sibling positioned over the notebook column.
- `GeometryCanvas.tsx` — read pointer coords in overlay space, not local SVG space.
- Section insert code — no change needed; z-order alone handles "new section slots under drawing" once the overlay is on top and click-through.

---

## Out of scope for this plan

- No changes to Point / Line / Circle / Arc / Angle / Distance behaviour beyond what auto-intersections already do.
- No change to serialization format beyond `GeoCurve.points` (backwards compatible).
- No visual redesign of the right-hand Properties panel.

## Verification

- Curve: click 5 points across the page → single smooth spline; double-click commits; dragging any anchor reshapes it; deleting an interior anchor keeps the curve continuous.
- Notebook-wide: start Line in section 1, click in section 1, click in section 4 → one straight line spans all four sections; add a new section between them → new section appears underneath the line, text unaffected.
- Regression: existing 3-point curves still render (legacy `a/mid/b` path).
