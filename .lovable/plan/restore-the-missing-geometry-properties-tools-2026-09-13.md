# Restore the missing Geometry properties tools

## What is actually missing

The Geometry panel on the right of a lesson note is currently showing only the
selection editor (Undo/Redo, "Nothing selected…", Open Geometry Relationships,
Delete diagram).

The block that used to sit at the top of that panel — **Diagram Tools** with
**Add Text**, **Add Angle**, **Add Area**, plus **Erase** and **Select** and the
step-by-step workflow card (type the value, then pick the line, colour and
density choices for Area, the "picked so far" counter, cancel, and error
notices) — is no longer shown.

That block still exists, fully working, and is still used by the Smartboard
geometry workspace. When lesson-note diagrams were converted into in-flow
blocks, the lesson note stopped rendering it. Nothing was deleted, only
disconnected — so the previous working version is available as the source of
truth.

## What will be restored

The lesson-note Geometry panel will again show, above the selection
properties, exactly what the working version shows:

- Add Text — type the text/measurement, then click the line it belongs to.
- Add Angle — type the angle value, then click a line at the intersection.
- Add Area — pick colour and density, trace the enclosing lines, with a live
  count of picked lines.
- Erase and Select buttons, with the erase explanation.
- The compact "Add Text / Angle / Area" row when something is selected, so the
  selected item's properties still own the panel.
- Cancel and the in-panel notices for each running workflow.

Everything already working stays untouched: the left Geometry menu (Select,
Point, Line, Circle, Arc, Curve, Disalign Point, Add Text, Add Distance, Add
Angle, Add Area), the barriers, click-accurate drawing, point visibility,
Undo/Redo, Open Geometry Relationships, and Delete diagram.

## Technical detail

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` → `LiveEditor`:
  wrap the registered panel node so `DiagramToolsPanel` renders above
  `SelectionInspector`, passing `hasSelection={editor.selectedObjects.length > 0}`
  and `pickCount={editor.pendingIds.length}`; add `editor.pendingIds` to the
  `useMemo` deps so the pick counter and workflow state refresh live.
- Same composition the Smartboard uses in
  `geometry-editor/GeometryWorkbench.tsx` (lines 107-128) and the same shape
  the removed lesson-note code used, so behaviour matches the previous version.
- The smart-tool click handling in `GeometryCanvas.tsx` (`smartText`,
  `smartAngle`, `smartArea`) and the drafts in `GeometryModeContext.tsx` are
  already intact; no geometry logic changes.
- After wiring, cross-check the geometry feature registry
  (`src/lib/integrity/standard/geometry.ts`, GEO-006 / AREA-00x / GPROP-00x)
  and re-connect any other entry whose panel is listed but not rendered in the
  lesson note.

## Verification

- Enter 2D on a lesson note: Diagram Tools appears with all three Add tools.
- Add Text on a line, Add Angle at an intersection, Add Area over a region.
- Select a line: properties own the panel with the compact Add row above.
- Erase removes a single line; Undo/Redo, Relationships and Delete still work.
