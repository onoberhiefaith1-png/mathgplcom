## Goal

Drop the geometry **frame** entirely. When the teacher toggles the Diagram button, Geometry Mode turns on, the left toolbox appears, and drawing happens **directly inside the lesson note at the caret position** — no boxed frame, no resize handles, no hover chrome. Then audit every tool (Point, Line, Midpoint, Compass, Polygon, Circle, Arc, Right angle, etc.) so each one actually works.

## 1. Remove the frame

- Delete the `geometryDiagram` TipTap **NodeView chrome**: faint border, hover handles, edge toolbar, rotate/resize grips, lock/duplicate buttons. The node still exists as a data carrier, but renders as a plain inline SVG with no border, no padding, no background.
- Remove `GeometryEditorPanel` (already in spec) and any remaining "frame selected" UI.
- Strip `GeometryModeContext.activeFrameId` from the selection model — there is no "active frame" anymore.
- Auto-enter/exit Geometry Mode based on caret selection is removed; the only way in/out is the **Diagram toolbar button**.

## 2. New drawing model: caret-anchored canvas

- Geometry Mode ON → the toolbox shows on the left, and a **single ambient overlay canvas** mounts over the lesson note's editor surface (absolute, pointer-events on, transparent background).
- Drawing operations write to a **scene that lives at the current caret position** in the document:
  - If the caret is already inside an existing `geometryDiagram` node → edits go to that node's scene.
  - Otherwise, the first click inserts a new `geometryDiagram` node at the caret (or end of current section) and starts the scene there. No visible frame — just the rendered SVG flowing inline with the text.
- Clicking elsewhere in the text just moves the caret. The next drawing click writes to whatever node the caret now sits in (creating one if needed). This gives the "edit anywhere" behaviour the teacher asked for.
- Diagram toolbar button OFF → overlay unmounts, toolbox hides, SVGs stay rendered inline with zero chrome.

## 3. Tool audit (must all work end-to-end)

For each tool below: bind it to `useGeometryEditor`, exercise it manually in preview, fix any wiring/op gaps. Required tools:

- **Select** — click an object, shows subtle highlight only (no frame).
- **Point** — single click places labelled point (auto label A, B, C...).
- **Line / Segment / Ray** — two clicks.
- **Midpoint** — click a segment → places labelled midpoint.
- **Compass / Circle** — 3-click (centre, through, confirm) per current spec.
- **Arc** — 3-click (start, through, end).
- **Polygon** — n clicks + double-click / Enter to close.
- **Right angle marker** — click vertex then two rays, drops the small square.
- **Angle marker** — same flow, drops the arc + value.
- **Label / Text** — click position, inline edit.
- **Delete** — Backspace / toolbox eraser on selected object.
- **Undo / Redo** — already in `useGeometryEditor`, re-verify keyboard bindings.

Each tool's op lives in `src/lib/geometry/editor/sceneOps.ts`; missing ones get added there.

## 4. Files touched

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — strip NodeView chrome to plain SVG render.
- `src/components/lessonnotes/geometry-editor/GeometryModeContext.tsx` — remove `activeFrameId`, add caret-anchored scene resolver.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` (new or repurposed) — ambient overlay handling pointer events while Geometry Mode is on.
- `src/components/lessonnotes/geometry-editor/GeometryToolbox.tsx` — no change to layout, just confirm all 10+ tool ids are listed and dispatch correctly.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — accept a scene-resolver instead of a single scene prop.
- `src/lib/geometry/editor/sceneOps.ts` — fill in any missing per-tool ops (midpoint, right-angle, polygon-close).
- `src/components/lessonnotes/DocumentEditor.tsx` — mount overlay; remove auto enter/exit on diagram selection.

## 5. Out of scope

- Scene data model, AI Edit panel, sketch-to-geometry backend — untouched.
- Resize / rotate / move / lock / duplicate — gone with the frame, not replaced (the teacher edits by re-drawing or deleting objects).

Proceed?
