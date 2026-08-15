# Diagram in Smartboard + Unified Undo + White TVD Default

Enhancement only. The existing 2D geometry engine, 3D/TVD workspace, Lesson Notes editor and Smartboard board are all reused as they are.

## What exists today (verified)

- The 3D/TVD workspace defaults come from `src/lib/geometry3d/scene3d.ts`: `theme: "dark"`, `backgroundColor: "#0d0b1e"`. `LIGHT_BACKGROUND` (`#f6f7fb`) and the theme/background controls already exist in the settings panel.
- The Smartboard already has a foldable top strip (the pull-tab header in `PresentationView.tsx`) holding Shelf, title, Clear, zoom, beat navigation, Settings. There is currently **no** Diagram entry anywhere in Smartboard.
- The 2D diagram editor is already host-agnostic and event-driven: `openGeometryEditor({ scene, onApply, sessionId })` from `geometry-editor/GeometryEditorPanel.tsx`. The 3D/TVD workspace is `geometry3d/Workspace3DDialog` with `initialScene` + `onExport`.
- Smartboard undo is a snapshot stack over `{ freeLines, lineOffsets, smartLines, boxes }` only. The diagram editor keeps its own separate stack (`src/lib/geometry/editor/history.ts`). So diagram work is invisible to Smartboard undo.
- Board content persists per board scope via `boardKey(bucket, boardScope)` buckets (freewrite, offsets, smartlines, boxes, sensor…), so each notebook/section keeps its own board state.

## 1. White TVD/3D background by default

- Change the 3D workspace defaults to a light theme with the light background as the initial value.
- Keep every existing background/theme control working, so switching to black (dark) still applies and persists for that scene.
- Scenes already saved with an explicit background keep their stored value — only fresh/default scenes change.

## 2. Diagram in the Smartboard top foldable panel

- Add a single **Diagram** control to the existing top header (next to Settings) with two choices: **2D** and **3D / TVD**. No layout redesign; the same pill styling as the current buttons.
- **2D** opens the existing geometry editor panel inside the Smartboard (right-edge dock, the same component Lesson Notes uses) with a live board-owned scene.
- **3D / TVD** opens the existing 3D workspace over the board and, on close/export, keeps the scene attached to the board.

## 3. Diagrams as real board content

- Introduce a board diagram collection (2D scenes and 3D scenes) stored in a new `boardKey("diagrams", boardScope)` bucket, following exactly the pattern used for `boxes`.
- Each diagram renders on the board at its own position, draggable like a magnet box, and stays selectable/re-editable (clicking it reopens the same editor with the same scene).
- Because storage is scoped by `boardScope`, a diagram created on one notebook/section board stays on that board and reappears on return or reload; it never leaks onto another page.
- No second diagram engine: the board only holds scene data and delegates all drawing/editing to the existing engine.

## 4. Unified Undo / Redo

- Add the diagram collection to the Smartboard snapshot type so `{ freeLines, lineOffsets, smartLines, boxes, diagrams }` is one chronological history.
- Every diagram edit committed from the editor updates board state, which pushes exactly one entry onto the shared stack — so the most recent action is always what Undo reverses, whether it was text, a smart line, a box or a diagram line/point/angle.
- When the editor runs inside Smartboard, its Undo/Redo buttons drive the board history instead of the panel's private stack, so there are never two competing stacks. In Lesson Notes the panel keeps its current private history untouched.
- Redo restores the diagram scene exactly as it was, since snapshots hold whole scenes.

## 5. Explicitly unchanged

- Lesson Notes layout, controls, left-hand geometry toolbox, right-hand Diagram Tools, AI flows, page model.
- Existing export-to-Smartboard flow keeps working; the Smartboard consumes the actual diagram scene rather than a duplicate.

## Files expected to change

- `src/lib/geometry3d/scene3d.ts` — default theme/background.
- `src/components/smartboard/PresentationView.tsx` — Diagram menu in the top header, diagram state + persistence, snapshot/undo wiring, editor/dialog mounts.
- New `src/components/smartboard/BoardDiagramLayer.tsx` — positions/renders board diagrams using the existing renderers.
- Small additive props in `geometry-editor/GeometryEditorPanel.tsx` (external history hooks when hosted by the board).

## Verification

Manual passes for the six scenarios: white TVD default (and black still selectable), Diagram → 2D / 3D from the top panel, undo/redo hitting the newest diagram action, redo restoring it, and diagram persistence across page/board switches and reload.
