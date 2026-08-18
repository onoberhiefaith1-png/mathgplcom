# Geometry Map — derived from the solution, not from the diagram

Replace the Specific/General relationship generator with a single **MAP**: the list of
mathematical principles actually used by the solution that was generated for that question,
each one linked to the exact diagram objects it applies to.

Pipeline: **Question → Diagram → Solution → extract principles → MAP → click a map item →
diagram glows.**

## What exists today (verified)

- The guide already travels with the diagram in `scene.meta.geometryProperties`
  (`src/lib/geometry/properties/model.ts`), object references are stable ids, and
  `GeometryCanvas` already paints three highlight roles (selected / related / emphasised).
- `GeometryPropertiesWorkspace` + `GeometryPropertiesPanel` are the teacher surface;
  `GeometryGuideView` (inside `GeometryDiagram`) is the student surface.
- The current model is built around `category: "specific" | "general"`, "Define a Part"
  virtual objects, whole-diagram AI suggestion sweeps, and a 4-way publish access setting —
  all of that is what this change removes.
- A diagram is already bound to its question through `ownerQuestionId`
  (`containerRange.ts`), and `DocumentEditor` already serialises a question's mathematics
  (`serializeRangeAsMath`) for AI generation. That is the hook the map generation uses.

## The change

### 1. Data model — one map, ordered steps
`scene.meta.geometryMap` (new key, version 2):

```text
geometryMap: {
  version: 2,
  published: boolean,
  generatedFromSolution: boolean,
  items: [{
    id, order,
    principle,          // "Angles in the Same Segment"
    relation,           // symbolic only: "∠ABC = ∠ADC"  (no numbers)
    explanation,        // one line of theory
    usedTo,             // "Used to find ∠BDC"  (symbolic, no answer)
    stepIndex,          // which solution step used it
    producesToken?,     // what this step establishes  ("∠BDC")
    needsTokens?,       // what it consumed from earlier steps
    objectIds: [id],    // exact diagram objects that glow
    source: "ai" | "teacher",
    enabled
  }]
}
```
Legacy `geometryProperties` items are read once and carried over as unordered teacher items
so nothing already authored is lost; `category`, `virtuals` and `access` are dropped.

**No numbers in the map.** A sanitiser strips numeric values/units from `relation`,
`usedTo` and `explanation` before saving (degrees, cm, decimals), keeping labels
(A, B, C, x, θ, AB, ∠ABC, arc AB). Numbers stay in the solution only.

### 2. Map generation from the solution
New `geometry-map` edge function. Input: the question text, the full generated solution text,
and the read-only object inventory of the scene (ids + truthful names). Output: ordered map
items with `principle`, `relation`, `explanation`, `usedTo`, `stepIndex`, dependency tokens
and `objectIds` chosen from the supplied ids only — anything referencing an unknown id is
rejected server-side. One item = one principle; no principle that the solution did not use.

Trigger: after `DocumentEditor` generates a Solution for a question that owns a diagram, the
map is built for that diagram automatically and stored on its scene. A **Generate Map from
Solution** button in the panel re-runs it on demand (and is the path for notes whose solution
already exists).

### 3. Teacher panel (replaces the current right panel content)
```text
GEOMETRY MAP            Generated from solution
1  Cosine Rule            — used to find BC          👁 ✎ 🗑 ↕
2  Tangent–Radius Theorem — right angle at tangency
3  Pythagoras             — used to find BD
...
+ Add Map Item      Generate Map from Solution      Publish to students
```
- Clicking a row highlights its objects on the live diagram (selected/related roles).
- Edit changes principle, symbolic relation, explanation and "used to" text.
- **Relink**: with a row in relink mode, clicking diagram objects toggles them into
  `objectIds` (chips shown on the row) until Done — the teacher never types `AB` or `∠BAC`.
- Add / remove / reorder / enable-disable per row. Reordering keeps `stepIndex` for display
  of the pathway.
- Removed from the UI: Specific, General, Define a Part, relationship-suggestion sweeps,
  the operator chip builder as the primary path, and the 4-way access selector (publish is
  now a single toggle).

### 4. Pathway view
Under the list, a compact vertical pathway rendered from `stepIndex` +
`producesToken`/`needsTokens`:

```text
Given
  ↓  Cosine Rule            → BC
  ↓  Tangent–Radius         → 90° at tangency
  ↓  Pythagoras             → BD
  ↓  Power of a Point       → BE
  ↓  Sine Rule              → required value
Answer
```
Nodes are clickable and behave exactly like the list rows.

### 5. Student experience
`GeometryGuideView` becomes **Solution Map**: diagram on the left/centre, ordered numbered
map on the right. One active item at a time — clicking it glows its objects, dims the rest,
and shows principle + symbolic relation + explanation + "used to". No categories, no filters,
no AI, no authoring, read-only diagram. Nothing shows unless the teacher published and the
item is enabled.

### 6. Diagram is untouched
No new engine, no redraw, no geometry mutation from the map — highlighting is an overlay
role on the existing canvas/static renderer, exactly as it works today.

## Technical notes

- New: `src/lib/geometry/map/model.ts` (types, read/write on `scene.meta`, legacy carry-over,
  number sanitiser, id validation, pathway derivation), `GeometryMapPanel.tsx`,
  `MapPathway.tsx`, `supabase/functions/geometry-map/index.ts`.
- Edited: `GeometryPropertiesWorkspace.tsx` (map panel + pathway, keeps the white
  Lesson-Note surface and "← Back to Lesson Note"), `GeometryGuideView.tsx` (student map),
  `GeometryDiagram.tsx` (student highlight wiring), `SelectionInspector.tsx` (entrance label
  becomes "Geometry Map"), `DocumentEditor.tsx` (post-solution map generation for the
  question's diagram).
- Retired: `GeometryPropertiesPanel.tsx`'s specific/general + virtual-part authoring,
  `RelationshipPanel.tsx`/`RelationshipEditorSheet.tsx` if unreferenced after the swap, and
  the whole-diagram mode of `relationship-ai`.
- No database migration — the map lives on the scene, so it travels with the note, class copy,
  slide and Smartboard automatically.
