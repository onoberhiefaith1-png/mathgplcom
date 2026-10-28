# Teacher-Controlled Layout: Movable Solution, Movable Diagram, One Undo History

No redesign of the diagram engine, no second diagram, no change to AI generation order, no automatic repositioning. AI generates; the teacher arranges.

## What the workspace does today (verified)

- `canvasFrame` (`extensions/CanvasFrame.tsx`) is already a real, absolutely-positioned, freely-movable document node, dragged by its gutter in `DocumentEditor.tsx:2241-2264`, writing `x`/`y` back onto the node so moves live in the document history. This is the movable-object primitive the fix builds on.
- The question block moves as one unit today because everything under its heading lives in the same frame. That behaviour is kept untouched.
- A diagram (`geometryDiagram`) is a document node with a stable `diagramId` and `draggable: true`, but the first mouse-down on it calls `setNodeSelection`, which immediately swaps the static SVG for the live drawing canvas (`extensions/GeometryDiagram.tsx`). So in the normal workspace there is no way to move the diagram — clicking it always starts editing it.
- Geometry Mode already exists as an explicit flag (`geometry-editor/GeometryModeContext.tsx`: `mode`, `activeFrameId`). Nothing currently uses it to gate whether a diagram is movable or editable.
- Diagram scene edits and diagram insertion already write through the document history (`commitScene` + `closeHistory`), so text and diagram creation are one chronological stack. Frame moves are also transactions. What is missing is that a *diagram move* has no representation at all, because diagrams cannot be moved.

## 1. Solution splits from the question, keeps its relationship

- Add stable identities: `questionId` on a question heading block, and on the Solution block `solutionId` plus `ownerQuestionId`. Existing notes get ids assigned lazily on load without consuming an undo step (same pattern already used for `diagramId`).
- Hovering the Solution heading area reveals a grab affordance. Dragging it detaches the Solution block only: the Solution's nodes move into their own `canvasFrame` at the drop coordinate, carrying `ownerQuestionId`. The question text and the diagram do not move.
- Dragging an already-detached Solution just updates its frame `x`/`y` — one history entry per completed drag.
- The relationship is permanent: regeneration of the solution for that question rewrites the *existing* Solution object in place, wherever the teacher parked it, instead of inserting a new one. Solution lookup becomes "find the block whose `ownerQuestionId` matches", not "the block physically under the heading".
- Dragging the question continues to move the whole question structure as it does today.

## 2. Diagram becomes a movable object outside Diagram 2D mode

Interaction is decided purely by Geometry Mode state:

```text
Geometry Mode OFF  ->  press and drag on the diagram = move the whole diagram object
Geometry Mode ON   ->  existing Diagram 2D editing, selection and tools (unchanged)
```

- With Geometry Mode off, mouse-down on a diagram no longer runs `setNodeSelection`, so the live canvas never mounts and no edit/align state is entered. Instead a drag begins: on drop, the diagram node is placed in its own `canvasFrame` at that coordinate (or its existing frame coordinates are updated), keeping its `diagramId` and its owning `questionId`. Geometry, points, labels, angles, lines, circles and annotations all travel with it because the whole scene is one node attribute — nothing is re-derived.
- A click without movement (below a small drag threshold) keeps today's behaviour of activating the diagram, so nothing regresses for teachers who click into a figure.
- No border, box, margin line, or container outline is added around the diagram. The only visual change during a drag is the standard grab cursor and the object following the pointer.
- With Geometry Mode on, mouse-down behaves exactly as it does today: select, edit, use tools, right-hand Properties Panel.

## 3. One undo history for every workspace operation

- Diagram creation, diagram scene edits, diagram *moves*, Solution detach, Solution moves, question moves and text edits are all single, ordered entries in the document history. Each completed drag closes its history group so a drag is one undo step, not dozens of intermediate positions.
- Result for the stated sequence: Undo reverses solution move, then diagram move, then diagram creation, then text creation. Undoing a diagram creation removes the diagram and leaves the question and solution in place. Redo restores the same scene and the same coordinates.
- The private geometry undo stack stays in the file for other hosts but is not the source of truth inside a lesson note.
- Lazy id backfill stays outside the history so it can never be undone into an inconsistent state.

## 4. Generation stays as it is

The asynchronous order (question, then solution, then diagram a few seconds later) is unchanged. Nothing auto-moves the solution to make room, nothing regenerates or reconstructs a diagram, and no second diagram is ever created — the existing duplicate-suppression check stays. The teacher performs the final arrangement.

Not included in this pass: the relationship/theorem feature.

## Technical notes

Files expected to change:

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — mode-gated mouse-down: drag-to-move when Geometry Mode is off, existing selection/editing when on; move writes coordinates through the document history.
- `src/components/lessonnotes/extensions/SolutionRow.tsx` and `SolutionObjectView.tsx` — `solutionId` / `ownerQuestionId` attributes and the grab affordance on the Solution block.
- `src/components/lessonnotes/DocumentEditor.tsx` — shared object-drag helper reused by frames, solutions and diagrams (one history group per drag); detach-into-frame; id assignment; solution regeneration targets the existing solution object by `ownerQuestionId`.
- `src/components/lessonnotes/extensions/CanvasFrame.tsx` — allow a frame that hosts a single detached object (solution or diagram) with no added chrome.
- `src/lib/lessonnotes/containerRange.ts` — resolve a question's solution and diagram by relationship id rather than by physical position.

Explicitly unchanged: 2D drawing tools and gestures, guidance bar, selection inspector, Properties Panel layout, AI prompts and standards, 3D workspace, note hierarchy, composer bars, DB schema.

## Verification

In the live preview on the geometry note: generate an Example with a solution and let the diagram arrive late; drag the Solution below the diagram and confirm the question and diagram stay put; drag the diagram with Geometry Mode off and confirm it moves whole with no edit mode and no border; turn Geometry Mode on and confirm clicking a line, point and angle still edits; regenerate the solution and confirm it updates the moved solution object in place; then press Undo repeatedly and confirm solution move, diagram move, diagram creation and text creation reverse in that order.
