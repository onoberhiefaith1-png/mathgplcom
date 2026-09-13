# 2D Geometry — temporary, sensor-placed drawing region

Rebuild the 2D barrier behaviour so 2D is a temporary editing mode inserted at the cursor, never a permanent box.

## Behaviour to deliver

1. **Open at the cursor.** Pressing 2D reads the current cursor position each time. If a diagram already sits at (or immediately next to) that position, reopen it for editing. Otherwise insert a new temporary drawing region right there — never at the top of the note, never the question's first figure.
2. **Two barriers only.** Upper line fixed at the top of the region, lower line movable, both spanning the full width of the page (not the width of the drawing). Between them is the drawable area.
3. **Lower barrier controls:** up, down, drag, delete. It can never rise above the upper barrier (minimum region height enforced). Moving it down pushes every following block — text, examples, solutions, exercises, images, other diagrams — down, because the region reserves real document height. Moving it up pulls them back.
4. **Cursor inside a line.** Insertion splits the current text block at the cursor so text before stays above the upper barrier and text after flows below the lower barrier. No line is moved wholesale above the region.
5. **Nothing drawn = nothing kept.** Leaving 2D (toggle off, clicking elsewhere, deselect) removes the region entirely if its scene is still empty, restoring the original layout with no leftover gap. A region with real geometry is kept, and its barriers/controls disappear.
6. **Editable only in 2D.** With 2D on, the active diagram is editable by all geometry tools. With 2D off, diagrams render view-only: no dragging, selecting or altering geometry by accident.
7. **Delete control** removes the region, its barriers and the drawing, and closes the gap in the note.
8. **Point default off.** Entering 2D starts with point labels off: lines, circles, arcs and curves draw clean, internal construction points stay hidden and unlabelled, no highlight added just because labels are off. The Point toggle beside the tools turns visible, letterable points back on; switching it never rebuilds or breaks the figure.
9. **All existing tools keep working:** Select, Point, Line, Circle, Arc, Curve, Add Text, Add Distance, Add Angle, Add Area — connections, measurements and angles unchanged.

## Technical notes

- `DocumentEditor.tsx` — `ensureGeometryRegion`: always compute from `state.selection.to`; reuse only a geometry node adjacent to that pos; when the caret is mid-paragraph, `splitBlock` before `insertContentAt` so trailing text lands after the node. Track the pos of a freshly opened region in a ref so exit can inspect it.
- Exit path (2D toggle off, `setGeometryMode(false)`, and node deselection): if the tracked node's `scene` has no objects, delete the node and clear its reserved `height`.
- `GeometryDiagram.tsx` — barriers already keyed on `geometryModeOn && selected`; keep that, keep `MIN_REGION` clamping, remove the duplicate bottom resize grip so the lower barrier is the single control. Render `LiveEditor` only when `geometryModeOn && selected`; otherwise `StudentGuideDiagram` (view-only). Barrier rules must be page-width (already `absolute left-0 right-0` on the NodeViewWrapper) — verify the wrapper is `w-full` so they are not clipped to the figure.
- Barrier chrome is mode-only React output: no node attrs, no serialization, absent from export/print.
- Point behaviour: `GeometryModeContext.showPoints` (default false, persisted) already drives `ensurePoint` hidden/auto points in `GeometryCanvas.tsx`; force it off on each 2D entry and confirm the toggle reveal/hide pass keeps geometry intact.

## Verification

Run the ten acceptance scenarios in the running app: open at cursor under a solution, move barrier down/up with reflow, exit without drawing (region gone), exit after drawing (diagram kept), reopen that diagram, open a second region at a different cursor spot, draw with points off then on, and delete the region. Plus typecheck and the geometry/in-flow diagram tests.
