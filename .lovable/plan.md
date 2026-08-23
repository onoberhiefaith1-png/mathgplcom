# Review Properties on the Smartboard

Goal: the diagram the teacher drew in the lesson note is the diagram shown on the Smartboard, and the teacher-authored Geometry Properties attached to that diagram's own objects can be reviewed there — two-way: click an object to see its properties, click a property to light up its objects.

No Smartboard redesign, no second geometry viewer, no AI, no regeneration.

## What already exists (verified)

- Diagrams already travel with the note as saved scenes: the board renders `geometryDiagram` note objects through `SolutionObjectView` → `PresentationGeometryDiagram`, using the exact saved `scene` and its stable object ids. Nothing regenerates it.
- Teacher-authored properties already live on that same scene at `scene.meta.geometryProperties` (`readProperties`), each item carrying `sourceObjectIds`, `connectedObjectIds`, optional token→object bindings, `reason`, plus teacher-defined virtual parts (∠ABC, distances, unknowns) that resolve back to real object ids.
- The read-only diagram renderer already supports highlighting a set of ids (the `diff` prop). It does not yet support clicking an object.

So the work is: make the read-only board diagram pickable, and add a Review Properties panel that reads only that diagram's own property document.

## 1. Pickable read-only diagram

Add optional `highlightIds` and `onPickObject` to the read-only diagram renderer (`GeometryDiagram.tsx`). When `onPickObject` is supplied, an invisible hit layer is drawn over the same geometry it already renders (points, segments, angles, arcs, circles, regions), each hit shape carrying its object id. Clicking reports that id; `highlightIds` reuses the existing highlight path. With no handler passed, behaviour is unchanged everywhere else.

## 2. REVIEW PROPERTIES entry point

In the Smartboard top chrome, immediately after `← Back`, add a **REVIEW PROPERTIES** button. It only appears when the diagram currently on the board has at least one authored property.

- Default state: closed. The diagram keeps the full board width; nothing is reserved.
- Clicking opens a right-side panel at ~1/5 of the board width, with its own scroll. The diagram stays visible and interactive, and simply re-lays out to the remaining width.
- Closing returns the board to full width and clears any review highlights. The diagram itself is untouched.

## 3. Panel behaviour

Scope: the panel resolves properties from the scene of the diagram currently presented, keyed by its `diagramId`. Properties from other diagrams, questions or sections can never appear — there is no lesson-wide lookup.

- **Object → properties.** Clicking a geometry object lists every property whose `sourceObjectIds`, `connectedObjectIds`, token bindings, or virtual parts reference that exact id. No text matching. An object with no properties changes nothing except normal selection.
- **Property → objects.** Clicking a property highlights exactly the objects it references (expanding virtual parts to their real ids) and shows its reason text underneath. Selecting another property or another object clears the previous highlights first, so only one set is ever lit.
- Everything is computed from the already-loaded scene: no fetch, no reload, no AI, instant response.
- The existing Geometry Reasoning text stays as it is and is surfaced with the active property.

## 4. Verification

Walk the board with the current quadrilateral note: exact saved diagram appears; panel opens at ~1/5 and closes back to full width; clicking angle A shows only A's properties; clicking `A + C = 180°` lights angle A and angle C and nothing else; switching property or object replaces the highlight; an object with no properties shows nothing; reload keeps all authored properties; moving to another diagram shows zero properties from the previous one.

## Technical notes

- `src/components/lessonnotes/GeometryDiagram.tsx`: additive `highlightIds` / `onPickObject` props plus a hit layer built from the same object pass that draws the figure.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx`: `PresentationGeometryDiagram` forwards the two new props; `InlineGeometryDiagram` and the editor node view are unchanged.
- New `src/components/smartboard/ReviewPropertiesPanel.tsx` (~1/5 width dock) and a small selector module resolving object↔property links from `readProperties(scene)` and the scene's virtuals.
- `src/components/smartboard/PresentationView.tsx`: the toggle in the top chrome, review state (`open`, `selectedObjectId`, `activePropertyId`, `highlightIds`) scoped per presented `diagramId`, and the width split when open.
- No database migration: properties already persist inside the scene, so they travel with the note, the class copy, slides and published snapshots.
