## 1. Activate Undo / Redo in Geometry Mode

The `useGeometryEditor` hook already exposes `doUndo`, `doRedo`, `canUndo`, `canRedo` — they just aren't wired into the embedded (in-note) editor. Only the legacy right-edge `GeometryEditorPanel` shows the buttons.

**Changes**
- `LiveEditor` in `src/components/lessonnotes/extensions/GeometryDiagram.tsx`:
  - Attach a keyboard listener while the diagram is selected: `Ctrl/Cmd+Z → doUndo`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y → doRedo`.
  - Pass `canUndo`, `canRedo`, `doUndo`, `doRedo` into `SelectionInspector` via new props.
- `SelectionInspector.tsx`: render a compact **Undo / Redo** row pinned to the top of the right-hand panel (always visible while a diagram is selected, independent of what's selected inside it). Disabled state when history is empty.

## 2. Add Area — Straight vs Curved trace

The `addArea` tool currently collects points and closes them with straight edges only. Introduce a **trace mode** toggle stored on the annotation draft.

**Changes**
- `GeometryModeContext.tsx`: extend `AnnotationDraft` with `traceMode: "straight" | "curve"` (default `"straight"`). When `setTool("addArea")` runs, seed `{ tool: "addArea", traceMode: "straight", confirmed: true }`.
- `GeometryToolbox.tsx`: when the active tool is `addArea`, show two segmented buttons under it — **Straight** and **Curved** — that flip `traceMode`. Update the hint text accordingly.
- `GeometryCanvas.tsx` (`addArea` case near line 426, and the preview overlay at line 555 / 561):
  - **Straight mode** (current behaviour): each click appends a point, straight edges connect consecutive points, close on start-point click / double-click / Enter.
  - **Curve mode**: points come in triplets. For every 3 clicks (1,2,3), emit a Catmull-Rom (or quadratic-through-middle) curve segment through the middle point using `sampleCatmullRomBetween`; the 3rd point becomes the start of the next triplet so the curve is continuous. Live preview draws the smoothed path.
  - Store the resulting region using `addRegion` with `edges` populated as curve-typed edges when in curve mode (extend the existing `GeoRegionEdge` union in `scene.ts` if a "curve" edge kind isn't already defined; if it is, reuse it).

## 3. Delete Diagram button in the right-hand panel

When any part of a diagram is selected in the note, the right-hand Properties Panel should end with a **Delete Diagram** action that removes the whole geometry node.

**Changes**
- `LiveEditor` (`GeometryDiagram.tsx`) already has TipTap's `deleteNode`. Pass it into `SelectionInspector` as an `onDeleteDiagram` prop.
- `SelectionInspector.tsx`: render a bottom section (after all other selection editors) with a destructive **Delete diagram** button (red text, trash icon, one-click, with a confirmation `window.confirm`). Always visible whenever `onDeleteDiagram` is provided, regardless of what specific object is selected.

## Technical notes

- No changes to `useGeometryEditor` or history logic — the API is already sufficient.
- Curve trace uses the existing `sampleCatmullRomBetween` sampler already imported in `GeometryCanvas.tsx`.
- Keyboard handler is scoped to the selected diagram's wrapper so it doesn't hijack shortcuts elsewhere in the note.

## Files touched

- `src/components/lessonnotes/geometry-editor/GeometryModeContext.tsx`
- `src/components/lessonnotes/geometry-editor/GeometryToolbox.tsx`
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx`
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx`
- (possibly) `src/lib/geometry/scene.ts` — add `"curve"` region-edge kind if missing
