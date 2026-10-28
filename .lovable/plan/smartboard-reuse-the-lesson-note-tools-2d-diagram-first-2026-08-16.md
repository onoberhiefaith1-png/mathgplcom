# Smartboard — Reuse the Lesson Note Tools (2D Diagram First)

The Lesson Note is the source of truth. Nothing gets redesigned; the Smartboard mounts the
same components inside floating, movable canvases above the board.

## What's true today (checked in the code)

- The board already floats the Lesson Note Graph, mathematical reference Tables
  (`MathTablesPicker` + `MathTableView` — not Smart Table), Calculator body and
  Conversion body inside a shared shell (`FloatingToolLayer`), page-scoped and in the
  board's history.
- 3D already uses the Lesson Note `Scene3DCanvas` / `Workspace3DDialog`, and the board's
  floating 3D card already has an "Axes" toggle.
- The 2D case is the broken one: the floating card renders the **read-only**
  `GeometryDiagram` preview (so no drawing at all), and editing opens
  `GeometryEditorPanel` — a right-edge dock that is *not* the Lesson Note interface.
  The Lesson Note instead uses: `GeometryModeProvider` + left `GeometryToolbox` +
  live `GeometryCanvas` (`useGeometryEditor`) + right-hand `DiagramToolsPanel` and
  `SelectionInspector` published through the Properties Panel.
- The toolbar shows two permanent buttons `2D` and `3D` instead of one `Diagram` entry.

## Plan

### 1. One shared 2D workbench (the core fix)
Extract the Lesson Note's 2D wiring into a reusable `GeometryWorkbench` that renders
left toolbox | live drawing canvas | right tool/selection panels, each side panel
independently collapsible, using the existing `GeometryModeProvider`,
`useGeometryEditor`, `GeometryCanvas`, `GeometryToolbox`, `GeometryToolbar`,
`DiagramToolsPanel` and `SelectionInspector` — no new geometry tools, no new toolbar.
The Lesson Note keeps rendering the exact same tree through this component so both
surfaces stay literally identical.

### 2. Mount it on the board
The board's 2D floating card renders `GeometryWorkbench` instead of the static preview,
so drawing works immediately with mouse, touch and pen (same pointer handling as the
Lesson Note canvas). Remove the board's `GeometryEditorPanel` dock and its
`editing2dId` path. The card stays movable, resizable, positionable over board text, and
opens at a generous default size (roughly 720×520) with the existing 8-handle resize.

### 3. Diagram menu
Replace the `2D` / `3D` pair in the top bar with a single **Diagram** button opening a
small menu with **2D** and **3D**, matching the Lesson Note grouping.

### 4. Lifecycle: draw → commit → edit → delete
- Newly inserted diagram = editable floating workbench.
- **Done** in the card header commits it: the card collapses to the static
  `GeometryDiagram` render anchored on the page.
- **Edit** on a committed diagram reopens the workbench in place.
- **Delete** removes only the diagram layer; board text and objects are untouched.
- Every geometry commit already flows through `setDiagrams`, which is one entry in the
  board's shared Undo/Redo — drawing a line, point or circle is undoable from the board.

### 5. 3D axes visibility
Keep the working 3D system as-is; add the same eye-style visibility toggle at the top of
the `Workspace3DDialog` chrome so X/Y/Z can be hidden and shown without being deleted
(the floating card's toggle stays, switched to an eye icon for consistency).

### 6. Theme / readability pass across all five tools
Thread the board palette (`chromeBg`, `chromeFg`, `chromeBorder`, `dark`) into the tool
bodies so a white board gives light surfaces with dark text and a dark board gives dark
surfaces with light text. Targets: Tables, Graph, Calculator, Conversion, 2D panels and
3D chrome — remove translucent/blurred layers where text lands on a same-tone
background. Presentation only; no functional changes to these four tools.

## Technical notes

- New: `src/components/lessonnotes/geometry-editor/GeometryWorkbench.tsx` (extraction).
- Edited: `BoardToolLayer.tsx` (2D body, commit/edit actions, eye icon),
  `FloatingToolLayer.tsx` (Done action, palette on body, larger defaults),
  `PresentationView.tsx` (Diagram menu, drop the 2D dock, palette threading),
  `DocumentEditor.tsx` / `extensions/GeometryDiagram.tsx` (use the extracted workbench),
  `Workspace3DDialog.tsx` (axes eye toggle).
- `BoardDiagram` gains a `committed?: boolean` flag in `src/lib/smartboard/boardDiagrams.ts`
  with a sanitizer default, so existing saved pages keep loading.
- No database changes.
