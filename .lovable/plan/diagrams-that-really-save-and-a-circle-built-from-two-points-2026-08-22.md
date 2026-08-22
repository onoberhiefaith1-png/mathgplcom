# Diagrams that really save, and a circle built from two points

## What the data shows right now

For the open note (quadratic equation, saved 09:22 UTC today):

- The saved document contains **no geometry diagram node at all** — zero `geometryDiagram`, zero circle nodes.
- The saved blocks contain exactly one object: the division-ladder table inside Example 1's Solution.

So the circle on screen exists only in the live editor; it was never written to the note. That is why it cannot appear on the Smartboard: the board can only draw what the note saved. The Smartboard pipeline itself (block objects to beat objects to full-scale render) is already in place, so the missing link is the save, not the board.

The exact reason the node is not written is not yet confirmed — the two candidates are (a) inserting/editing a diagram never marks the document dirty, so autosave skips it, or (b) the diagram lives in the geometry workbench overlay and is never committed into the document. Step 1 settles this before any behaviour changes.

## Plan

1. **Confirm the break.** Trace insert to autosave to `document_json` for a 2D diagram on this note: does the node enter the editor document, does the save fire, does it survive serialization. Report which of the two candidates it is.
2. **Guarantee diagram persistence.** Make diagram insertion, diagram edits and workbench commit all mark the note dirty and be included in the saved document, with an explicit save on commit so a diagram can never be left only on screen.
3. **Prove it end to end.** After saving, the note's blocks must carry the diagram object, and the teacher and student Smartboard must both render it — 2D geometry outside a Solution and inside a Solution (notes layer).

## The circle becomes a real construction

Today a circle stores a centre point plus a plain radius number, so there is nothing on the rim to grab.

4. A circle is created from **two points**: the centre, and one point on the circumference. The radius is the distance between them — never a stored number that can drift out of step.
5. **Dragging the centre moves the whole circle** (up, down, left, right); the rim point travels with it, so the radius does not change.
6. **Dragging the rim point changes the radius** — outwards makes the circle bigger, inwards smaller. The centre stays put, and everything attached to the circle (arcs, sectors, radius/diameter lines, labels) follows.
7. **The points stay optional.** A per-circle "show points" control lets the teacher hide the centre dot, the rim dot, or both, for a clean board figure. Hidden points remain grabbable in edit mode so the circle is still adjustable, and invisible on the Smartboard.
8. Existing circles keep working: on load, a circle with only a numeric radius gains a rim point at that radius, so old notes are unchanged visually.

## Technical notes

- Save path: `src/components/lessonnotes/DocumentEditor.tsx` (dirty/autosave), `src/components/lessonnotes/geometry-editor/GeometryWorkbench.tsx` (commit), `src/lib/lessonnotes/syncDocumentToNotebook.ts` (already writes per-block objects).
- Circle model: `src/lib/geometry/scene.ts` (`GeoCircle` gains a rim point id and derived radius), `src/lib/geometry/editor/sceneOps.ts` (translate centre, resize from rim), `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` (handles + hit testing), `SelectionInspector.tsx` (show-points toggle).
- No new renderer and no second diagram engine: one scene model, one canvas, one Smartboard renderer.

## Verification

Draw a circle from centre plus rim point, drag the centre (circle moves, radius unchanged), drag the rim (radius changes), hide both dots, save, then open the Smartboard and confirm the circle appears on the teacher and student board.
