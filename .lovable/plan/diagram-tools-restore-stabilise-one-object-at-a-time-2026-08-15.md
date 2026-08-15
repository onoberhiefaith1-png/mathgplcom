# Diagram Tools — restore, stabilise, one-object-at-a-time

Goal: keep every existing diagram capability, but fix the interaction so the right-hand panel is plain by default, shows exactly one object's properties at a time, and each of the three tools runs a short temporary workflow that ends itself.

Nothing is rebuilt. All work is in the selection/tool plumbing and the panel shell; the geometry model (points, lines, relationships, intersections, regions, labels, styles, distances) is untouched.

## What is actually broken (verified in code)

- **Multi-click / mixed panels.** In `GeometryCanvas.tsx` the `select` tool *accumulates* selection: clicking an object adds it to the set, clicking it again removes it, and clicking a second object forces the kind to `segmentBody`. Two or more picks then route to the generic multi-selection panel instead of point/line properties — this is why properties "don't appear" until repeated clicking.
- **Degraded line panel in the lesson note.** `DocumentEditor.tsx` renders `SelectionInspector` without `selectedIds`, so sub-arc/sub-curve line items and the line-selection panel lose information the standalone geometry panel has.
- **Add Text has no value-first flow.** `smartText` requires clicking a shape first, then an inline canvas edit — not "enter the text, then click the line".
- **Add Angle never signals completion.** After the second line it creates the angle but leaves the tool armed, the value box still showing, and no selection of the new angle.
- **Add Area asks for points, not an enclosed region.** `smartArea` traces boundary points and needs a manual close on the first point, even when the lines already enclose a region.

## The interaction model

```text
NOTHING SELECTED   → DIAGRAM TOOLS: Add Text | Add Angle | Add Area   (+ Erase | Select)
POINT selected     → point properties only
LINE selected      → line properties only
TEXT selected      → text properties only
ANGLE / AREA made  → that object's properties, tool returns to Select
```

While a tool is running, the panel shows only that tool's step ("Enter text", "Select line", "Select two lines", "Select enclosed region") with a Cancel. On completion the step UI disappears and the panel returns to the three-tool default.

## Changes

1. **Single selection (core fix)** — `GeometryCanvas.tsx`, `select` case: a click replaces the selection with the hit object and sets the true hit kind; clicking the same object keeps it selected (no toggle-off); blank paper clears. Drag priming (point drag, label drag, distance drag, angle-value drag) works on the first click, so labels stay draggable. Shift-click is kept as the explicit way to build a multi-object selection, so constraints ("make equal", "isosceles") and the existing angle-from-two-lines panel still work.

2. **Pass `selectedIds` through** — `DocumentEditor.tsx` forwards `geometryEditor.selectedIds` (and undo/redo props it already has) to `SelectionInspector`, so the lesson-note panel behaves identically to the standalone panel.

3. **Contextual panel shell** — `DiagramToolsPanel.tsx` renders the three-tool grid plus Erase/Select only when nothing is selected and no tool workflow is running. When an object is selected, the tool grid collapses to a single "Add…" row so the properties own the panel. `SelectionInspector`'s existing routing (point / point label / line / distance / angle / region / text panels) is reused unchanged.

4. **Add Text workflow** — value first: the panel asks for the text ("47 cm", "ASB"), then switches to "Select line or point"; the next click on a line attaches a rotating midpoint label, on a point an anchored label, on blank paper a floating label at that spot. No Enter step, no inline canvas editor. The new text is selected afterwards so its colour/size properties (existing `LabelPanel` / `SegmentLabelPanel`) appear, and it stays draggable and editable.

5. **Add Angle workflow** — value first, then "Select two lines" with a live `1/2 · 2/2` counter and highlighted picks. On the second line the angle is created at the shared vertex (internal by default), the tool resets to Select, the new angle is selected, and its properties (including the existing reflex/external toggle) show. If the two lines share no vertex, the panel says so and keeps the first pick instead of silently doing nothing.

6. **Add Area workflow** — "Select enclosed region": clicks pick *lines*, not points. After each pick the picked set is tested with the existing `cycleFromSegments` helper; as soon as the picked lines form a closed cycle the region is created with the chosen fill colour/opacity, the tool resets to Select, and the region is selected so its fill/opacity/area properties show. Manual point tracing stays available for open shapes as a fallback link in the same step panel.

7. **Clear selection state** — the existing halo/glow layer is reused: current selection glows, in-progress tool picks glow in a distinct accent, and pick highlights clear when the workflow completes or is cancelled.

8. **Erase and Select** — unchanged behaviour, verified against objects created by the three tools (text label, angle, region) so single-segment erase still removes only that piece.

## Technical notes

- Files touched: `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` (select case + the three smart tool cases), `DiagramToolsPanel.tsx` (step UI), `GeometryModeContext.tsx` (`AnnotationDraft` gains a `step` field so the panel and canvas agree on the current stage), `DocumentEditor.tsx` (pass `selectedIds`), and small additions to `SelectionInspector.tsx` only where a newly created object must be auto-selected.
- No changes to `src/lib/geometry/*` model files, `sceneOps`, `intersections`, `regions`, `snap` or the scene schema; region closure uses `cycleFromSegments` as it exists.
- No database or AI changes.
