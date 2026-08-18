# Geometry Relationship Guide — whole-diagram AI map, click-to-build relationships, glow highlighting

Build the interaction shown in the reference on top of the existing Geometry workspace. The diagram
engine, the scene and the lesson-note system stay exactly as they are: this adds a relationship layer
stored on `scene.meta.geometryProperties` (already the storage today) and rewires the panel around
"click a part → see what it can be used for".

## 1. Whole-diagram AI generation (currently per-selection only)

Today AI Assist only asks for suggestions about the one selected object. Change it to a single
**Generate Relationships** action that analyses the whole diagram once:

- Send the full object inventory (points, segments/lines/rays, angles, arcs, circles, regions, labels,
  plus given values, tick-mark equalities and parallel/perpendicular marks already present in the scene)
  with each object's stable id and truthful name.
- Ask for relationships grouped per component, each returning: the component id it belongs to, the
  statement, a short reason ("Angles on a straight line", "Given", "Same segment"), a category
  (Angle / Line / Area / Theorem-Rule) and the ids of every object involved.
- Reject anything referencing an id or label that is not in the diagram, so no invented variables.
- Sine/Cosine Rule and triangle relationships only when the referenced triangle actually exists in the
  scene.
- Results land as drafts the teacher approves — unchanged rule: nothing reaches students unapproved.
- Detected-objects summary strip under the diagram (Points, Lines/Segments, Angles, Arcs, Circles,
  Areas) as in the reference, computed from the real scene — not from AI output.

## 2. Panel: "Relationships for …" with category filters

Right panel gets the reference layout:

- Empty state: "Geometry Relationships — click any part of the diagram to explore its relationships."
- With a selection: header `RELATIONSHIPS FOR: ∠ACD = 40°` (the resolved name plus its known value),
  and filter chips **All / Angle / Line / Area / Theorem-Rule**.
- Grouped, numbered lists per category with the reason in muted text, an eye toggle per item
  (show/hide to students) and, in teacher mode only, edit / delete / reorder / approve.
- Every row is clickable — clicking is the highlight action, for teacher and student alike.

## 3. Glow highlighting on click

Extend the canvas highlight painting (it already accepts `highlightIds`) with three visual roles:

- **Selected** — the clicked part, blue.
- **Related** — objects the chosen relationship involves, amber.
- **Emphasised** — the relationship's own subject, red/pink accent.

Everything else stays visible but dimmed. Highlights fade in with a short CSS transition and a soft
pulse, so the eye follows: click → glow → related parts illuminate. A legend (Selected / Related /
Highlighted) sits under the diagram, matching the reference.

## 4. Teacher manual builder — no typing of mathematical objects

Replace free-text entry as the primary path with a **click-to-build** row:

```text
[ AB ]  [ = ]  [ AC ]                       → "AB = AC"
[ ∠ABC ] [ + ] [ ∠ACB ] [ = ] [ 180° ]      → "∠ABC + ∠ACB = 180°"
[ AB ]  [ ∥ ]  [ CD ]                       → "AB ∥ CD"
```

- Clicking a diagram object appends it as a chip; the object stays glowing while the statement is
  being built.
- An operator palette inserts `=  ≠  <  >  +  −  ×  ÷  ∥  ⟂  ∴` plus value chips (`180°`, `90°`,
  `360°`, and a numeric/unit entry for things like `10 cm`).
- The statement string is generated from the chips, so the teacher never types `AB` or `∠ABC`.
- Backspace removes the last chip; Save Relationship stores content plus every referenced object id —
  so highlighting works for teacher-built items exactly as for AI ones.
- Free-text remains available as a secondary "type it instead" option for explanations.
- Angles, distances, arcs and areas that are not drawn objects keep the existing "define a part" flow
  and can be used as chips.

## 5. One list, two sources

AI and teacher relationships live in the same list with a small source badge (AI / Teacher). Teacher
can edit, delete, reorder, enable/disable, approve. Categories Specific / General and the publish
access setting (Off / Specific / General / Both) stay as they are.

## 6. Student side

`GeometryGuideView` follows the same interaction: no tool choice, no AI, no authoring. Click any part
of the diagram → its published relationships appear grouped by category → click a relationship → the
diagram glows. Unpublished or access off ⇒ diagram only.

## Technical notes

- `src/lib/geometry/properties/model.ts`: add a `RelationshipGroup` ("angle" | "line" | "area" |
  "theorem") field with a back-compatible default, a `reason` field, `sceneInventory()` for the
  detected-objects counts and the AI payload, and `buildStatement(chips)` for the click-builder.
- `supabase/functions/relationship-ai/index.ts`: add a whole-diagram mode returning per-component
  relationships with `group`, `reason`, `connectedObjectIds`; keep the existing per-selection mode
  working; validate ids server-side before returning.
- `GeometryPropertiesPanel.tsx`: header + filter chips, grouped numbered rows with eye toggles, the
  chip-based builder, operator palette, Generate Relationships button.
- `GeometryCanvas.tsx`: three highlight roles, dimming of non-involved objects, transition/pulse.
- `GeometryPropertiesWorkspace.tsx`: detected-objects strip, legend and "how it works" footer;
  white Lesson-Note surface and Back to Lesson Note stay.
- `GeometryGuideView.tsx` + `GeometryDiagram.tsx`: student click-a-part → grouped relationships →
  glow, reusing the same renderer.
- No new diagram engine, no second scene, no changes to lesson-note editing.
