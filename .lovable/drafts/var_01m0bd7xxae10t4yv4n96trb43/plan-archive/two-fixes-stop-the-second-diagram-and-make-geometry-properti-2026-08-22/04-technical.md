# Technical notes

**Part A**
- `supabase/functions/notebook-ai/index.ts` (blueprint prompt): replace the "already-drawn
  diagram → set diagramRequired true" clause with "reuse the existing diagram; do not describe
  or require a new one".
- `src/lib/lessonnotes/ai/pipeline/generate.ts`: the diagram stage additionally requires that
  the owning question has no diagram; `DocumentEditor` already computes `hasDiagram` for the
  session context and passes it in.
- No change to `geometry-sketch` / the scene builder, and no change to insertion position.

**Part B**
- New `src/lib/geometry/properties/teacherProperties.ts`: `TeacherProperty`
  (`id`, `diagramId`, `tokens: Array<{ text: string } | { objectId: GeoId; text: string }>`,
  `referencedObjectIds: GeoId[]`, `order`), read/write on `scene.meta.geometryProperties` (v3),
  plus `propertiesFor(objectId)` and one-time carry-over of `geometryMap` items into properties.
- `GeometryMapPanel.tsx` → rewritten as `TeacherPropertiesPanel.tsx`: create/edit/reorder/delete,
  chip insertion from selection, working function keypad, id-based filtering, property→objects
  highlight with legend. The `generateGeometryMap` server fn and its call site are dropped from
  this feature.
- `GeometryPropertiesWorkspace.tsx`: keeps the same scene instance and back navigation; header
  and panel swap to Teacher Edit.
- `GeometryGuideView.tsx`: becomes the read-only viewer used by student Smartboard/notes.
- Smartboard: a toggle in the existing board controls mounts the panel as a closable right dock
  (~1/3 width), default closed, independent scroll.
- Storage stays on the scene's own `meta`, so properties travel with the note, the class copy,
  slides and published snapshots. No database migration.
