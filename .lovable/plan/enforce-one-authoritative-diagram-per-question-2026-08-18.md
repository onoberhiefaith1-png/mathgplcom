# Enforce one authoritative diagram per question

## Verified cause

There is not a separate simplified renderer to delete. The duplicate is created when the existing authoritative `geometryDiagram` has been moved into a free `canvasFrame` before its question heading has a stable `sectionId`:

- the detach path stores `ownerQuestionId: null` on that frame;
- the ownership scan can no longer associate the moved diagram with its question;
- a later AI generation sees “no diagram” and the automatic geometry pass inserts another one.

There is also a manual **Duplicate diagram** action that can bypass the one-question rule.

## Changes

### 1. Make diagram ownership permanent before movement
- Add a shared helper that resolves the owning question heading and assigns its `sectionId` when missing, without adding an Undo step.
- Use it when detaching a diagram into a free frame, so every moved diagram receives a valid `ownerQuestionId`.
- Reuse the same helper for Solution ownership instead of maintaining two different ownership implementations.

### 2. Strengthen diagram discovery
- Make `diagramsOwnedByQuestion` recognize the authoritative diagram in flowing content, free frames, and Solution cells through stable ownership.
- Add a compatibility fallback for existing orphaned frames with `ownerQuestionId: null`, so previously saved notes do not generate another diagram.
- Preserve the existing `diagramId`, scene, labels, edits, and placement; do not redraw or replace it.

### 3. Hard-lock AI generation to question blocks only
- Change the automatic geometry trigger from “anything except a detected Solution” to a positive allow-list of question kinds only: Example, Exercise, Classwork, Homework, and Question.
- Keep Solution figure directives disabled.
- Re-check ownership immediately before insertion; if any authoritative diagram is associated with the question, return without inserting.
- A Solution receives only a `diagramRef` to the existing `diagramId` and matching existing element IDs.

### 4. Remove the lesson-note duplicate escape hatch
- Remove the **Duplicate diagram** action from the authoritative lesson-note geometry node.
- Route manual/new diagram insertion through the same ownership guard, so a request for a second diagram selects/reuses the existing diagram instead of creating another node.

### 5. Clean existing duplicate notes safely
- When the same question already contains multiple `geometryDiagram` nodes, retain the oldest authoritative diagram and its `diagramId`.
- Remove only later generated duplicates associated with that same question; never delete unrelated teacher-created diagrams from other questions.
- Keep cleanup in document history so it is undoable.

## Verification

- Generate Classwork with a diagram, move the diagram, then generate Solution: exactly one diagram remains.
- Regenerate the Classwork and Solution: the original scene, labels, edits, and `diagramId` remain unchanged.
- Test a previously orphaned framed diagram (`ownerQuestionId: null`): no second diagram is inserted.
- Confirm Solution text references the existing diagram and appears below it.
- Confirm Undo/Redo remains chronological and diagram editing still uses the existing 2D editor and right-hand Properties Panel.

## Technical scope

Expected files:
- `src/lib/lessonnotes/containerRange.ts`
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx`
- `src/components/lessonnotes/extensions/SectionHeading.tsx`
- `src/components/lessonnotes/DocumentEditor.tsx`

No renderer replacement, no new diagram engine, and no changes to the existing 2D geometry scene model.