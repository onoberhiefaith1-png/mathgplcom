# Geometry Relationship Workspace — visible entrance + finish the authoring layer

The authoring layer already exists and is wired into the note's right-hand panel:
`SelectionInspector` renders a **Geometry Properties** button (bottom of the panel, above
Delete diagram) which opens `GeometryPropertiesWorkspace` — a full-screen surface that mounts
the *same* `GeometryWorkbench`/scene, so no second diagram is created. What is missing is that
the entrance is small, unlabelled as "relationships", easy to miss under a long properties
list, and the workspace itself is not yet the focused environment described.

## 1. Make the entrance unmissable (the immediate issue)

In `SelectionInspector`'s chrome section, replace the current single small button with a proper
section, styled with the panel's existing tokens:

```text
────────────────────────────
GEOMETRY PROPERTIES & RELATIONSHIPS
Selected: LINE — AB          (or "Unnamed line" / "Unnamed point")
Explore how this element relates to the rest of the diagram.
[ Open Geometry Relationships ]
```

- Always rendered for **any** selection kind (point, line, segment, angle, arc, circle,
  region, label) and also with no selection, so the teacher can always get in.
- The "Selected:" line uses `describeObject` from the properties model, which already falls back
  to an intelligent unnamed description; never invents a label.
- Section sits directly under the existing properties and above Delete diagram; nothing else in
  the panel changes.

## 2. Workspace chrome: focused, note-owned

`GeometryPropertiesWorkspace` header becomes `← Back to Lesson Note` (left) with the title
"Geometry Relationships" and the current selection name. The workspace is a portal over the
note, so the lesson-note toolbar is already not rendered inside it; confirm nothing from the
note toolbar shows through, and keep the diagram + right panel as the only two regions.
Returning restores the note exactly (scene object is never re-created, scroll preserved).

## 3. Diagram-driven retargeting and highlight

Already partly present (panel targets `editor.selectedIds[0]`, canvas accepts `highlightIds`).
Complete it: clicking any object in the workspace canvas retargets the right panel immediately,
and the current target plus the connected objects of a hovered/edited relationship get the
authoring halo overlay only — no new objects, no change to the diagram's real appearance.

## 4. Structured connections (token → object)

Extend `GeometryPropertyItem` with an optional `tokens: { token: string; objectId: GeoId }[]`
(additive; existing items stay valid). In the panel, after typing a relationship such as
`cos θ = X / Y`, the teacher gets one chip per detected symbol (`X`, `Y`, `θ`) and taps a chip
then clicks the object on the diagram to bind it. `connectedObjectIds` stays as the flat list
used for highlighting, derived from the bindings plus any extra picks.

## 5. Specific vs General, AI optional

Both categories already exist and are stored separately per item. Keep the AI suggestion button
producing unapproved drafts the teacher accepts/edits/deletes/recategorises. Nothing reaches
students until approved + published.

## 6. Student side

`GeometryGuideView` (read-only, no AI) gains diagram-linked behaviour: clicking a published
relationship highlights its bound objects on the same diagram; clicking an object filters the
guide to that object's relationships. If the teacher defined nothing, the student sees nothing —
there is no student AI path anywhere in this component.

## 7. Storage

Unchanged: everything lives in `scene.meta.geometryProperties` on that specific diagram, so two
diagrams have independent relationship maps. No database migration.

## Technical notes

- Edited: `SelectionInspector.tsx` (entrance section), `GeometryPropertiesWorkspace.tsx`
  (Back-to-note header, selection title), `GeometryPropertiesPanel.tsx` (token chips, bind mode,
  hover highlight), `GeometryGuideView.tsx` (click-to-highlight), `properties/model.ts`
  (`tokens` field + sanitiser), and `GeometryCanvas.tsx` only if the pick/hover callbacks need
  widening (all behaviour stays behind opt-in props, off outside the workspace).
- No new diagram engine, no second scene, no changes to existing 2D drawing behaviour.
