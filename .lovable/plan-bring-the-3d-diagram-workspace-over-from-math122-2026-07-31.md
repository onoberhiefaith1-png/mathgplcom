# Bring the 3D Diagram Workspace over from math122

Copy the entire 3D geometry system from the math122 project into this platform, faithfully, and add a 2D / 3D split to the Diagram button in the Lesson Notes toolbar. The existing 2D geometry editor here is not touched in any way.

## What exists in math122

Clicking **Diagram** shows a small two-button strip: **2D** (the inline geometry editor) and **3D** (opens a full 3D Mathematics Workspace dialog). The 3D side is made of:

- `src/lib/geometry3d/` — 14 modules: scene model, solid factory, topology (real faces/edges/vertices), measurement, labelling, label settings, display scale, transforms, nets, cross-sections, formula library, worked example, lesson modes, units.
- `src/components/lessonnotes/geometry3d/` — `Workspace3DDialog`, `Scene3DCanvas`, `SolidElements`, `LessonOverlay`, `ObjectInspector`, `LessonModePanel`, `WorkspaceSettingsPanel`, plus `labels/` (6 files: annotation manager, construction layer, Label3D, label layer, settings panel, layout hook) and `lessonmodes/` (12 topic tool panels: angles, coordinates, cross-sections, faces/edges/vertices, measurements, nets, properties, surface area, volume, transformations, plus shared kit).
- `src/components/lessonnotes/extensions/Scene3DDiagram.tsx` — the tiptap node that stores a scene in the note and re-opens it in the workspace.

## What will be done here

1. Copy all of the above files across verbatim (only import paths adjusted where this project's equivalents differ, e.g. toast/router helpers).
2. Register `Scene3DDiagramNode` in this project's Lesson Notes editor extension list.
3. Add the 2D / 3D strip beside the existing Diagram button: **2D** keeps calling exactly the current geometry mode code, **3D** opens the copied `Workspace3DDialog` and inserts the exported scene as a `scene3dDiagram` node.
4. Mount `Workspace3DDialog` in the editor, wired to the same open/apply/export pattern used in math122.

## Explicitly untouched

The current 2D geometry engine (`GeometryDiagram`, `geometry-editor/`, `GeometryToolbox`, `GeometryAiPanel`, `lib/geometry/`, the Properties Panel behaviour and every diagram asset in the Asset Library) is left exactly as it is. The 3D system is additive.

## Technical notes

- `three`, `@react-three/fiber` and `@react-three/drei` are already installed here, so no new dependencies.
- 3D canvases are client-only; the workspace dialog renders only when opened, so SSR/prerender is unaffected.
- Saved notes keep working: existing documents contain no `scene3dDiagram` nodes, and the new node is additive to the schema.
- Verification: insert a 3D solid into a lesson note, close and reopen the note to confirm the scene persists and re-opens for editing, and confirm the 2D flow is unchanged.
