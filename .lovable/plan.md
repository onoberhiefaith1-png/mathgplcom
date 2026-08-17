# Fix Global Undo for Diagrams + Question/Diagram Ownership

Two targeted structural fixes. No redesign of the 2D diagram editor, guidance bar, selection behaviour, or drawing tools.

## What the code actually does today (verified)

- The lesson note Undo/Redo buttons call the editor's built-in history (`DocumentEditor.tsx:2250-2251`), which covers everything stored as a document node.
- An AI/manual diagram **is** a real document node (`geometryDiagram`, with a `scene` attribute) — `extensions/GeometryDiagram.tsx:329-380`. Its scene writes go through normal document transactions (`:165`, `:189`), so inserting a diagram *is* recordable.
- But the diagram editor also keeps its **own private undo stack** (`geometry-editor/useGeometryEditor.ts` + `lib/geometry/editor/history.ts`), and Ctrl+Z inside the diagram is bound to that private stack (`GeometryDiagram.tsx:264-277`). So there are two independent histories that can disagree about "the most recent action".
- Diagram insertion happens in a **fire-and-forget async pass** after the text is already inserted (`DocumentEditor.tsx:1108-1164`). Because it lands in a later, separate transaction group, it is a separate undo step — but its grouping is not pinned, so a diagram can be swallowed into the same undo step as the text that preceded it.
- Placement bug: that geometry pass runs for **every** AI generation, including when the Solution block itself is generated. `skipGeometryPass` (`:1093-1101`) never checks the section kind, and the insert position walks forward from whichever heading triggered the call (`:1106`, `:1138-1152`). When the Solution heading is the anchor, no further heading is found, so the diagram falls to the end of the Solution body — the diagram ends up inside/after the Solution instead of under the question.

## Fix 1 — One chronological undo history

- Make every diagram insertion its own undo step: insert the `geometryDiagram` node in a transaction that starts a fresh history group, so it can never merge with the text step generated just before it. Result: text → diagram → Undo removes the diagram, Undo again removes the text; reverse order works the same way, because order follows the transaction log, not content type.
- Route the diagram editor's Undo/Redo (buttons and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y inside the canvas) into the document history instead of the private stack, so one stack governs text, diagrams, diagram edits, moves, deletes and images.
- Keep each committed diagram edit as one history entry: the scene write already goes through the document, so an edit (add line, move point, set angle) is undoable and redoable from the same button. Rapid drags stay a single entry rather than dozens.
- The private geometry stack stays in the file (other hosts still call it) but is no longer the source of truth when the diagram lives inside a lesson note.
- Redo is preserved: undoing a diagram then pressing Redo restores the same scene, since the whole scene travels with the node.
- The separate freehand notebook overlay canvas (`lesson-notes:notebook-geometry:<id>` in local storage) is a different layer and is out of scope for this fix.

## Fix 2 — The diagram belongs to the Question block

- Never run the geometry pass when the generation target is the Solution block. A diagram request triggered from a Solution regeneration resolves its anchor up to the owning **question** heading; if none is found, no diagram is inserted.
- Anchor the insert position to the question block: the diagram goes after the last question-text node and strictly before the Solution heading, inside the same container (frame / solution cell / body) as the question. It never crosses into another frame and never falls to the end of the document.
- If a question already owns a diagram, a new generation replaces that diagram in place rather than appending a second one lower down.
- Give the diagram its own vertical layout space inside the question block so the Solution always begins below the complete question (text + diagram) and can never overlap it.
- The diagram stays a live editable `geometryDiagram` node — same scene format, same editor, same selection and guidance behaviour. Nothing is flattened to an image.

Resulting structure: Question text → Question diagram → Solution heading → Solution content.

## Explicitly unchanged

2D drawing tools and gestures, guidance bar, element selection/inspector layout, AI prompt/standards for diagram generation, 3D workspace, lesson note hierarchy and composer bars.

## Files expected to change

- `src/components/lessonnotes/DocumentEditor.tsx` — geometry pass guard by section kind, question-anchored insert position, own-history-group insertion, replace-in-place.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — keyboard undo/redo routed to document history; host-aware history props.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` (+ `SelectionInspector` undo/redo buttons) — accept external history handlers when hosted in a lesson note.
- `src/lib/lessonnotes/containerRange.ts` — helper to resolve the owning question heading and the pre-Solution insert point.
- Diagram block spacing in the lesson note styles.

## Verification

Run the five stated tests: text→diagram undo order, diagram→text undo order, AI geometry question structure with no overlap, repeated undo through a full generated geometry question, and diagram element click/edit/move still working with the edit undoable from the main Undo button. Checks run in the live preview on a real lesson note.
