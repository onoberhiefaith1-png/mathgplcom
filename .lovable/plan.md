## What to build

### 1. Add Area follows existing geometry between clicks

Today, `addRegion` calls `findConnectingEdge` but the Add-Area workflow in `GeometryCanvas` only stores raw point ids, so the resolver never sees the arc/curve/circle that the user actually clicked along. Fix by resolving each edge as the teacher advances point-by-point:

- In `GeometryCanvas.tsx`, while the `addArea` trace is active, remember the last-clicked point and, on each new click, call `findConnectingEdge(prev, next)` to build a `GeoRegionEdge[]` alongside the boundary point ids.
- Pass the edges to `addRegion` (already accepts them via the refactor). On close (click first point or Enter), commit the region with its edges array so `regionEdgesToPath` renders the true arc/circle/curve.
- Broaden `findConnectingEdge`:
  - Circle case: choose sweep direction (short vs long) based on the previous edge's tangent so a two-click "half-circle" behaves; add a `longWay` toggle available via Shift-click for the ambiguous 180° case.
  - Curve case: also match when both points lie on any interior control point of the curve, not only endpoints.
  - Arc case: keep endpoint/on-arc detection; pick the sub-arc whose sweep contains both angles.
- When no geometry connects the two points, keep the straight fallback (current behavior) so free-form regions still work.
- Show the resolved edge kind in the annotation hint ("Following arc…", "Following curve…", "Straight") so the teacher gets feedback before the next click.

### 2. Undo / Redo works for diagram edits from the lesson note

Diagrams currently keep their own history inside `useGeometryEditor`, so the notebook-level Undo button can't reach them; conversely, in-diagram edits don't push onto the document history. Unify by routing diagram commits through the document:

- Every `commit` in `useGeometryEditor` already calls `onChange(scene)` which updates the ProseMirror node attrs. Ensure the editor wrapper (the NodeView for the geometry block) marks that transaction as a normal history step (not `addToHistory: false`) so ProseMirror's history plugin captures it.
- Remove the local `history` stack's role as the source of truth for user-visible undo. Keep it only for intra-drag coalescing; the notebook's Ctrl+Z becomes the canonical undo.
- Wire the toolbar Undo/Redo buttons and Ctrl+Z / Ctrl+Shift+Z inside `GeometryToolbox` to dispatch the ProseMirror `undo` / `redo` commands on the parent editor when a diagram is active, instead of calling `doUndo` / `doRedo` on the isolated hook.
- Verify: draw a segment → Ctrl+Z removes it; Ctrl+Shift+Z brings it back; same for annotation and region additions.

### 3. "Delete Diagram" action in the right-hand panel

- Add a bottom section to `SelectionInspector.tsx` (or the panel container that hosts it) that is always rendered when a diagram is the active frame — independent of whether any object is selected.
- Style it as a destructive button: red text, outline variant, `Trash2` icon, label "Delete Diagram".
- On click: confirm via a small inline `AlertDialog` ("Delete this diagram? This cannot be undone."), then remove the geometry node from the ProseMirror document (using the frame's node position). This deletion is a normal editor transaction, so Ctrl+Z restores it.
- After deletion, clear `activeFrameId` and any selection state.

## Files to touch

- `src/lib/geometry/editor/boundary.ts` — sweep direction, curve interior match, expose kind for hint.
- `src/lib/geometry/editor/sceneOps.ts` — accept `edges` from caller when provided.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — Add-Area trace stores edges; hint text.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — soften local history; expose `deleteFrame` hook.
- `src/components/lessonnotes/geometry-editor/GeometryToolbox.tsx` — route Undo/Redo to the parent ProseMirror editor.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — always-visible "Delete Diagram" footer with confirm.
- Node view wrapper for the geometry block (in `src/components/lessonnotes/…`) — provide `onDeleteFrame` and pass parent editor ref so Undo/Redo + Delete can dispatch document transactions.

## Verification

- Draw a circle with two points A, B → Add Area → click A then B → region shades the arc side, not the chord. Repeat with an arc and a curve.
- Add a segment, press Ctrl+Z → segment gone; Ctrl+Shift+Z → back. Repeat inside the same diagram and across diagrams.
- Open the properties panel with any diagram active → "Delete Diagram" is visible at the bottom → confirms → the entire diagram block is removed from the note → Ctrl+Z restores it.
