# One Diagram Per Question — The Solution Reuses It, Never Redraws It

Targeted fix. No changes to the 2D diagram editor, drawing tools, guidance bar, selection, Floating UI or AI solution wording.

## What the code does today (verified)

- `DocumentEditor.tsx:1132-1187` runs a fire-and-forget "geometry pass" after every AI generation, including Solution generation. It calls the backend `mode: "geometry"` (`supabase/functions/notebook-ai/index.ts:990`), which asks the model to *invent a scene* from the passage text, then inserts a new `geometryDiagram` node.
- For Solution generation the anchor is resolved up to the owning question heading (`:1111-1116`), and there is a guard that skips insertion when the question already owns a diagram (`:1158-1161`). That guard only inspects `[anchorHeadingPos, liveSectionEnd(anchorHeadingPos))` in flowing document order, so a diagram that lives in a `canvasFrame` / solution cell, or a question whose owner heading resolves to the Solution heading itself, is not seen — a second, differently-labelled diagram is then generated. This is the duplicate visible in the screenshot.
- `geometryDiagram` nodes carry only `scene` and `topic` attributes (`extensions/GeometryDiagram.tsx:407-425`). There is no stable identity, so nothing can *reference* an existing diagram; the only way the system knows how to "show a diagram" is to make one.
- Undo: diagram inserts and diagram scene edits now go through the document history (`commitScene`, `closeHistory`), so text/diagram undo is already chronological. This plan keeps that and extends it to the reuse path.

## Fix 1 — The Solution never generates a diagram

- Remove Solution generation as a trigger for the geometry pass entirely. When the generation target is a Solution block, the geometry pass does not run — no backend call, no scene, no insertion. The Solution can never own or create a diagram.
- The geometry pass runs only for a question-kind block (Example, Exercise, Classwork, Homework, Question), and only when that question owns no diagram yet.
- Strengthen the "already owns a diagram" check so it is container-aware: scan the whole question block including any `canvasFrame` and solution cells, not just the flowing sibling range. If any `geometryDiagram` exists in the question block, the pass is skipped.
- Solution AI text that contains a stray diagram/asset directive no longer materialises a geometry scene — those directives degrade to text as they already do for unresolvable assets, so the AI cannot smuggle in a second figure.

## Fix 2 — The existing diagram gets an identity, and the Solution references it

- Add a stable `diagramId` attribute to `geometryDiagram`, assigned once on creation (teacher-made and AI-made alike) and preserved across regeneration, save/load, and the preserve-and-reinsert path used when a question body is replaced. Existing notes without an id get one lazily on first load, without occupying an undo step.
- The question block owns exactly one authoritative diagram: `question.diagramId`.
- A generated Solution stores `diagramRef: { diagramId, elementIds: [] }` instead of a scene. When the solution text names an element the existing diagram already contains (line `AC`, angle `BAC`, point `O`), that element id is recorded in the reference — resolved by matching against the real scene's existing labels only. Nothing is created, renamed, moved, or re-derived; unmatched names are simply not referenced.
- Floating / Assign / highlight actions raised from a Solution resolve through the reference to the original diagram node and drive its existing highlight state. No new node, no flattened image.

## Fix 3 — Layout and ordering

- Diagram insert position stays as it is today: end of the question body, strictly above the Solution heading, inside the question's own container. Structure is always Question text → Question diagram → Solution heading → Solution content.
- The diagram node keeps its own full-width vertical band so Solution content can never overlap it.

## Fix 4 — Undo stays chronological

- Diagram creation, diagram edits, diagram deletion, the id backfill (non-undoable) and solution insertion all remain single, ordered steps in the one document history. Undo after "question → diagram → solution" removes solution, then diagram, then question. Redo restores the same scene, because the scene travels with the node.

## Technical notes

Files expected to change:

- `src/components/lessonnotes/DocumentEditor.tsx` — drop the Solution geometry trigger, container-aware existing-diagram scan, `diagramId` assignment and preservation, solution `diagramRef` capture.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — new `diagramId` attribute with parse/render and lazy backfill.
- `src/lib/lessonnotes/ai/materializeDirectives.ts` — diagram/asset directives inside Solution content never resolve to a geometry scene.
- `src/lib/lessonnotes/containerRange.ts` — helper to enumerate a question block across frames and cells.
- A small resolver used by Floating/highlight to map `diagramRef` → the live diagram node.

Explicitly unchanged: the 2D geometry editor and its tools, guidance bar, element selection/inspector, AI diagram prompt/standards for question-side generation, 3D workspace, note hierarchy, composer bars.

## Verification

In the live preview on a real geometry lesson note: generate a question with a diagram, then generate the Solution — exactly one diagram remains, with the original labels and centre, and the Solution sits below it with no overlap. Repeat with a teacher-drawn diagram inside a frame. Then click a line, a point and an angle to confirm editing still works, and press Undo repeatedly to confirm solution → diagram → question order.
