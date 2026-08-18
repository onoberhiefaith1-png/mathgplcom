# Geometry Properties — Relationship Map (authoring layer on the existing 2D editor)

A teacher-authored relationship layer that sits **on top of** the existing Geometry 2D
diagram. No second diagram engine, no redraw, no AI for students.

## What already exists (checked in the code)

- `GeometryScene` (`src/lib/geometry/scene.ts`) is the single source of truth: every point,
  segment, line, ray, circle, arc, angle, region, label and curve already has a **stable
  `id`** separate from its visible `label`. That is exactly the anchor the relationships need.
- `GeometryWorkbench` is the full live 2D interface (left toolbox | live `GeometryCanvas` |
  right `DiagramToolsPanel` + `SelectionInspector`) and is already reused by both the Lesson
  Note and the Smartboard.
- The canvas already reports the selected object(s) and a `HitKind`
  (`editor.selectedIds` / `selectedObjects` / `selectionKind`), and `SelectionInspector`
  already renders per-type properties for the selection.
- A dormant relationship layer exists but is **not mounted anywhere**:
  `SmartGeometryContext`, `RelationshipPanel`, `RelationshipEditorSheet`, plus
  `scene.meta.relationships` keyed by a *selection signature* (label-based, so it breaks on
  rename). The `relationship-ai` function already suggests name/formula/explanation.
- Students read notes through `NoteReader.tsx`, which renders the static `GeometryDiagram`.

## Plan

### 1. Data model — id-anchored, per diagram
Store the guide on the diagram itself, in `scene.meta.geometryProperties` (no database
change; it travels with the note, the class copy, the slide and the published snapshot):

```text
geometryProperties: {
  version: 1,
  access: "off" | "specific" | "general" | "both",
  items: [{
    id, category: "specific" | "general",
    kind: "statement"|"definition"|"theorem"|"property"|"formula"|"construction"|"note",
    content,                 // teacher text / formula
    sourceObjectIds: [id],   // the object it was authored from
    connectedObjectIds: [id],// arbitrary count, any object type
    aiGenerated, approved, enabled, order
  }]
}
```
References are **object ids only** (`point_83af`), never labels, so renaming a point never
breaks a relationship. Legacy label-signature entries in `scene.meta.relationships` are
migrated on first open, best-effort, and left untouched otherwise.

### 2. Entry point in the existing right panel
At the bottom of `SelectionInspector`'s existing selected-object section, add one row:
object type + resolved name (`LINE · AB`, or `Segment connecting A and B`, or
`Unnamed line` — never an invented label) and a **Geometry Properties** button, styled like
the panel's existing controls. Nothing else in the panel moves.

### 3. Geometry Properties workspace
Clicking it opens a full-surface workspace over the note (same overlay pattern as the slide
canvas): lesson-note text is hidden, the **same** `GeometryWorkbench` scene instance stays
mounted and live in the centre, and the right column swaps to the authoring panel.
`← Back to Lesson Note` returns; scene state, scroll and diagram position are preserved
because the scene object is never re-created.

The diagram is the navigation system: clicking any object on the canvas re-targets the
panel to that object immediately (panel + highlight re-render only, not the note).

### 4. Authoring panel
```text
GEOMETRY PROPERTIES
Selected: X  (Point)
──────────────
SPECIFIC     + Add relationship
GENERAL      + Add relationship
──────────────
per item: text, type, Connected chips, Edit · Delete · Reorder ·
          Specific↔General · Enable/disable · Preview
──────────────
+ Connect to Diagram      (connection mode)
✨ AI Assist → suggestions
Save · Preview · Publish check
```
**Connection mode**: activating it puts the canvas in pick state — every click adds/removes
that object as a chip (`✓ X ✓ θ ✓ H`) until **Done**. Editing or hovering a relationship
temporarily highlights its connected objects as an overlay only — the diagram's real
appearance is never changed.

### 5. AI assist (teacher only)
Reuse `relationship-ai`, extended to also propose `category` and **suggested connected
object ids** from the scene. Suggestions arrive as unapproved drafts the teacher can accept,
edit, re-connect or delete; nothing reaches students until approved and published.

### 6. Validation before publish
A check runs over every enabled item: source object still exists, all connected ids exist,
at least one connection present. Broken items are listed with a Review action and block the
publish toggle; nothing is silently published.

### 7. Diagram edits after authoring
Deleting an object that is referenced warns first ("Deleting X will affect 4 relationships
— Review / Continue"). Renaming/relabelling changes nothing, since links are id-based.

### 8. Student experience (read-only)
`NoteReader`'s diagram gains an optional guide layer, shown only when `access !== "off"` and
approved items exist. The student can click an object to see its published Specific/General
items (filtered by the access setting), and click an item to highlight its connected objects
on the same diagram. No create, edit, AI, or "generate missing" path exists on the student
side — the student component has no write or AI call at all. Undefined ⇒ nothing shown.

## Technical notes

- New: `src/lib/geometry/properties/model.ts` (types, id helpers, migration, validation),
  `src/lib/geometry/properties/store.ts` (read/write on `scene.meta`, resolve object display
  names, referenced-by lookups), `GeometryPropertiesWorkspace.tsx`,
  `GeometryPropertiesPanel.tsx`, `RelationshipItemCard.tsx`, `ConnectionModeBar.tsx`,
  `StudentGeometryGuide.tsx`.
- Edited: `SelectionInspector.tsx` (entry row only), `GeometryWorkbench.tsx` (optional
  highlight/pick props + right-panel slot), `GeometryCanvas.tsx` (authoring highlight overlay
  and connection-pick click handling, both opt-in and off by default), `scene.ts` (`meta`
  type), `NoteReader.tsx` (student guide mount), `supabase/functions/relationship-ai`.
- Existing 2D behaviour — point creation, auto intersections, labels, selection, Add Text /
  Angle / Area, Erase, positioning — is untouched; every new canvas behaviour is behind a
  prop that is absent outside the properties workspace.
- Rendering stays scoped: object selection updates the panel and an overlay layer only.
- No database migration.
