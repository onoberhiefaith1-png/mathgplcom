
# Geometry Mode — Embedded in Lesson Note

Replace the right-side dock + floating action bar with an in-document **Geometry Mode**, toggled from the existing Diagram button in the toolbar. The lesson note stays the workspace; geometry tools appear contextually.

## 1. Diagram button = mode toggle

In `DocumentEditor.tsx` toolbar:
- Diagram button becomes a toggle. Active state = highlighted (primary background).
- Clicking ON: enters Geometry Mode, mounts the left-side **GeometryToolbox**, and — if the caret is not already inside a `geometryDiagram` — inserts a new empty frame into the current section (under current heading, before next heading) and selects it.
- Clicking OFF: leaves Geometry Mode, unmounts toolbox. Frame stays in document, returns to faint idle look.
- Selecting any existing frame auto-enters Geometry Mode; clicking outside any frame (caret moves to text) auto-exits.

State lives in `DocumentEditor` (`geometryMode: boolean`, driven by selection + manual toggle).

## 2. Left-side floating GeometryToolbox

New component `GeometryToolbox.tsx` (replaces the right-side `GeometryEditDock`):
- Fixed position, left edge of the document column, vertically centred, own scrollbar.
- Two display modes persisted in `localStorage`:
  - **Collapsed**: icon-only, ~40px wide.
  - **Expanded**: icon + short label, ~140px wide.
- A small pin/chevron header toggles modes.
- Tools rendered as a single flat scrollable list (groups kept as subtle dividers + tiny uppercase labels). Reuses `TOOLS` / `ICONS` from current `GeometryToolbar.tsx`; that file is repurposed/renamed.
- Selecting a tool sets the active tool on the currently selected frame's editor state.
- Toolbox is independent of page scroll (`position: fixed`); its own overflow handled internally.

Existing `GeometryEditorPanel` right-side dock is removed.

## 3. Frame appearance (clean by default)

Rewrite the NodeView in `extensions/GeometryDiagram.tsx`:
- Idle: 1px `border-foreground/5` (almost invisible). No buttons, no handles.
- Hover near edge (within ~12px) OR TipTap `selected`: border turns blue, 8 resize handles + top-left move grip + top-right rotate handle appear, plus a compact edge toolbar (Delete · Duplicate · Copy · Paste · AI Edit).
- Mouse leaves frame area → handles + edge toolbar fade out.
- Removes the current always-visible floating black action bar.

Hover proximity implemented with a wrapper that listens to `mousemove` on the frame's bounding box + small padding.

## 4. Frame stays attached to its section

- Frame is inserted via `insertContentAt(endOfCurrentSection)` so it always belongs to a section.
- Move Up / Move Down (already part of section toolbar) keep working — frame moves with the section content because it's a block node inside it.
- No floating/absolute positioning of the frame itself.

## 5. In-frame drawing

`useGeometryEditor` already supports live edits; we keep it. The toolbox writes `tool` into the active frame's editor instance via a small context provider `GeometryModeContext` that exposes `{ activeFrameId, setTool, scene, applyOp }`.

Drawing surface inside the frame uses the existing `GeometryDiagram` SVG renderer + interaction layer; only the chrome around it changes.

## 6. AI Edit / Sketch / Generate

Kept. Triggered from the hover edge toolbar (AI Edit button) which opens the existing inline AI panel anchored to the frame (small popover, not a full side dock).

## 7. Files

Changed:
- `src/components/lessonnotes/DocumentEditor.tsx` — Diagram toggle, Geometry Mode state, mount `GeometryToolbox`, auto enter/exit on selection.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — new clean NodeView: faint idle border, hover-revealed handles + edge toolbar, rotate handle, remove always-on action bar.
- `src/components/lessonnotes/geometry-editor/GeometryToolbar.tsx` → rename/repurpose into `GeometryToolbox.tsx` (left-side fixed, collapsed/expanded modes, own scroll).
- `src/components/lessonnotes/geometry-editor/GeometryEditorPanel.tsx` — delete (replaced).
- New `src/components/lessonnotes/geometry-editor/GeometryModeContext.tsx` — bridges toolbox ↔ active frame.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — unchanged behaviourally; consumed via context.

Out of scope: scene data model, AI prompts, sketch→geometry backend.

Proceed?
