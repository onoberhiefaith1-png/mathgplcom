# Geometry Relationship Guide — fix the workspace, then finish the authoring/student flow

## What's wrong now

The Geometry Properties workspace opens as a full-screen panel that paints itself with the app's
`bg-background` surface and mounts the diagram on a transparent canvas. On the lesson-note screen that
surface resolves dark, and because the diagram canvas has no paper of its own, the result reads as a
dark, empty screen even when the scene has objects. The relationship data model, the authoring panel,
the AI assist call and the student guide component already exist — the workspace shell and the
select-any-part behaviour are the missing pieces.

## Stage 1 — Make the workspace look and behave like the Lesson Note page (first priority)

- Replace the workspace background with the same white paper surface the lesson note uses (paper theme
  tokens, not `bg-background`), so the canvas is always white regardless of the surrounding theme.
- Mount the selected diagram centred on that white paper at a readable size, scaled to fit the
  workspace, using the existing geometry scene as the single source of truth (no second diagram).
- Guarantee non-empty: if the scene has no objects, show a clear "this diagram is empty — draw it in the
  lesson note first" state instead of a blank screen.
- Chrome: only "← Back to Lesson Note" plus the diagram title. No lesson-note editing toolbar, no text
  editor. Right-hand properties panel stays, styled in the MyGPL light panel language.
- The diagram is selectable, not re-drawable: clicking any point / segment / angle / region / label
  selects it. Drawing tools are not shown here (the diagram is authored in the lesson note).

## Stage 2 — Select any meaningful part, one at a time

- Clicking an object makes it the active part; the right panel switches to it and the previously active
  part leaves the editing panel (its saved data stays attached).
- Add a "Define" affordance for parts that are not drawn as objects yet:
  - Angle: pick a vertex + two arms → the system records ∠ABC as a virtual angle object.
  - Distance, arc, area, unknown/value (x, y, θ) → defined from the objects they sit on.
  These become first-class relationship targets with stable ids, stored on the scene, without adding a
  new drawing workflow.
- The active part's name is shown in the panel header ("Point A", "Line AB", "∠ABC", "θ").

## Stage 3 — Relationship authoring per part

- Two categories kept as-is: **Specific** (this diagram) and **General** (definitions, rules, theorems).
- Per item: type (statement / definition / theorem / property / formula / construction / explanation),
  content, connected objects, enable/disable, delete, reorder.
- AI assist stays an optional teacher tool: suggestions arrive as unapproved drafts the teacher must
  edit/approve/delete. Nothing AI-produced is ever visible to students until saved and approved.
- Manual add is always available and never requires AI.

## Stage 4 — Real structured connections

- A relationship is stored as structured data: content plus the diagram object ids it involves, plus
  optional symbol→object bindings (θ, X, H).
- The teacher builds connections by clicking objects on the diagram while an item is in "connect" mode;
  each click toggles that object into the relationship. Connected objects are listed as removable chips.
- Selecting an item previews its connections as a highlight halo on the diagram.

## Stage 5 — Publish + visibility

- Access setting on the guide: No relationships / Specific only / General only / Specific + General.
- Publish / Unpublish, with a pre-publish check (every visible item approved, has content and at least
  one connected object).
- Unpublished or access-off ⇒ students see the diagram only.

## Stage 6 — Student guide

- In the published note, clicking a diagram object opens its predefined relationships for that object
  only; clicking a relationship highlights every connected object on the diagram (θ → X → H).
- No AI, no authoring controls, no generation for students. If the teacher didn't define it, it doesn't
  exist.

## Technical notes

- Files touched: `GeometryPropertiesWorkspace.tsx` (shell rebuild: white paper, fit-to-view diagram,
  selection-only canvas, empty state), `GeometryPropertiesPanel.tsx` (active-part switching, Define
  virtual objects, connect-mode chips, AI draft approval), `src/lib/geometry/properties/model.ts`
  (virtual object records: angle-from-vertex+arms, unknown/value, arc, area; helpers to name and resolve
  them), `GeometryGuideView.tsx` + `GeometryDiagram.tsx` (per-object student guide + highlight on
  relationship click), `SelectionInspector.tsx` (entrance unchanged).
- Reuses the existing `GeometryCanvas` renderer and the existing `relationship-ai` function; no new
  diagram engine, no new AI solver path.
- Relationship data continues to live on `scene.meta.geometryProperties`, keyed by stable object id, so
  it travels with class copies, slides and published notes.
