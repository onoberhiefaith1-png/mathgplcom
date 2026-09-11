# Diagrams become part of the lesson note itself

Today a diagram in a lesson note is really drawn on a separate sheet laid over the page. That sheet keeps its own coordinates, so a diagram can sit still while the writing moves, writing can slide under it, and the question-and-answer helper never sees the picture that belongs to the question.

This plan removes that separate sheet. A diagram becomes a real part of the note, like a picture placed into a word processor: it sits between two pieces of writing, takes the room it needs, and everything below it moves down or up as the writing above changes. No box, no border, nothing drawn around it.

## What changes for the teacher

- Insert a diagram anywhere in the note; it opens its own space at that exact spot.
- Press Enter above it and the diagram moves down. Delete writing above and it moves up.
- Writing can never pass behind or through a diagram; the next paragraph always starts below it.
- Selecting a diagram turns it into a drawing area in place, with all current drawing tools. Drawing stays inside its own space.
- Need more room? Drag the diagram taller (or the space grows as the drawing grows) and the writing below moves down. Shrink it and the writing comes back up.
- Existing notes keep their diagrams: anything currently on the overlay sheet is moved into the note at the place it visually sat, so nothing is lost.

## What changes for the AI

- Every diagram carries a permanent identity and a known place in the note, so it is tied to the exercise or solution it sits inside.
- When a question is generated, checked, or solved, the picture belonging to that question travels with the text: its points, lines, circles, angles, labels and measurements as written information, not just as an image.
- Generation order becomes: write the question, attach its diagram, read both together, check the mathematics, write the solution, check the solution against question and diagram, repair if they disagree, and only then show it to the teacher.

## Technical section

Current architecture (verified):

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` already defines a proper in-flow block node with a `diagramId`, and renders the live `GeometryCanvas` when selected.
- `NotebookGeometryOverlay` in `src/components/lessonnotes/DocumentEditor.tsx` (~lines 3927, 4081-4300) renders one notebook-wide scene absolutely over `paperLayerRef` and, in the effect at ~4147-4185, **deletes every in-flow `geometryDiagram` node and merges its objects into that overlay scene**. `syncPageGeometryNode` then writes the overlay back as invisible `pageLayer: true` carrier nodes anchored by measured screen coordinates. This absorb-and-reanchor loop is the root cause of every symptom in the report.
- `CanvasFrame` (`extensions/CanvasFrame.tsx`) additionally lets diagram frames leave document flow (`objectKind: "diagram"`, absolute x/y with a `SessionSpacer`).

Work:

1. **Delete the absorb loop.** Remove the effect that pulls in-flow `geometryDiagram` nodes into the notebook scene, and remove `syncPageGeometryNode` / page-anchoring by `coordsAtPos`. In-flow nodes are the only storage for a diagram.
2. **Retire the overlay as an authoring surface.** Replace `NotebookGeometryOverlay` with a one-time migration pass: read `pageLayer` carriers plus the `localStorage` notebook scene, split with `splitPageGeometryScene`, and insert each group as a normal in-flow `geometryDiagram` node at the position its carrier already records; then drop the carriers and the `pageLayer` attribute path. Keep `pageLayer` parsing only for reading legacy documents.
3. **Diagram-mode insertion.** Geometry mode (`GeometryModeContext`) no longer draws onto page space. Pointer-down in geometry mode with no diagram under the cursor inserts a `geometryDiagram` block at the nearest document position and starts the stroke inside it; `insertGeometryAtPoint` is rewritten accordingly.
4. **Block sizing.** Add `height` (and keep `align`) attributes on the node; the node view reserves that height in flow, exposes a bottom resize handle, and grows automatically when the scene's bounds exceed the current height. `GeometryCanvas` clamps drawing to the block's own coordinate space. No border, background, or outline in any state except a faint selection ring on the handle itself.
5. **Stop diagrams leaving flow.** In `CanvasFrame`, drop the diagram exception so `objectKind: "diagram"` frames are no longer absolutely positioned; `detachIntoFrame` for diagrams becomes a no-op and existing diagram frames are unwrapped into in-flow blocks on load. `SessionSpacer` stays for legacy text/session frames only.
6. **Structural ownership.** On insert and on document change, set `ownerQuestionId` from `ensureOwnerQuestionId`/`questionContextForOwner` so each diagram resolves to its enclosing question or solution block.
7. **AI payload.** Extend the lesson/question context builders to emit, per exercise, the question text plus its diagram's structured description (`describeExistingDiagram`, labels, given measurements, `scene.meta.geometryMap`) and the `diagramId`. Wire this into the question, solution and check calls in `supabase/functions/notebook-ai` (`questionTaskStandard`, `solutionCompletenessStandard`, `completenessVerifier`, `figureNeed`) so validation runs only after the diagram is attached, and a question/diagram mismatch triggers regeneration instead of a teacher-facing warning.
8. **Verification.** Unit tests for the migration pass, for reflow (insert/enter/delete/resize changes only vertical order, never overlap), and for the AI payload containing the diagram of its own exercise; typecheck; authenticated browser pass on a real note inserting text, diagram, text and pressing Enter above the diagram.

Not touched: hallway/building systems, Smartboard rendering of scenes, geometry engine maths, notebook themes, DOCX export beyond block flow.
