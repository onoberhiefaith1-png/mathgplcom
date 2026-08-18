# Restore natural Session & Diagram dragging, and stop Sessions overlapping

No redesign, no new buttons, no drag handles. Three existing mechanisms are reused: the section heading node, the geometry diagram node, and the free-positioned frame that already carries `objectKind` + `ownerQuestionId`.

## What is actually wrong today (verified in the code)

- Only the **Solution** heading is draggable, and only through a small grip icon rendered next to it (`lesson-solution-grip`, a `GripVertical` button). Every other session heading (Example, Classwork, Question, Homework…) cannot be moved at all. That icon is the "rigid" behaviour to remove.
- Diagram dragging already works when Diagram 2D mode is off, and a press without movement still opens the 2D editor. That part stays exactly as it is.
- A dragged session becomes an absolutely positioned frame. Absolute frames are outside the page flow, so nothing below them reacts to their height — that is precisely why a Session 1 solution grows over Session 2.

## 1. Session dragging (restore, no icon)

- Delete the grip button from the section heading; keep the heading's appearance unchanged.
- Every session heading (all kinds, not only Solution) gets a **grab band**: the upper strip of the heading block and the empty space to the right of its text. Pressing there and moving more than a few pixels drags the whole session — heading plus everything down to the next heading — freely up, down, left and right, following the cursor with no snapping. Pressing without moving keeps the current behaviour (caret / selection), so typing and text selection on the heading are untouched.
- The only visual feedback is the existing `cursor: grab` on that band while hovering. No icon, no outline, no handle.

## 2. Diagram dragging (keep, extend to the group)

- Diagram 2D mode off: unchanged free dragging of the whole figure, exactly like moving an emoji/object.
- Diagram 2D mode on / press-without-move: unchanged — the 2D panel opens as now.
- Group move: the diagram's own labels, angles, areas and text annotations already travel with it because they live inside the diagram scene. Frames that were split out of a diagram gain an `ownerDiagramId`, and dragging the diagram moves those frames by the same delta in the same single transaction, so relative positions are preserved and one Undo restores the whole group.

## 3. Sessions never overlap (automatic space)

Two complementary rules, both driven by measured height — no fixed coordinates anywhere:

- **Reserved flow space.** When a session is lifted into a frame, an invisible spacer stays behind at the point it came from. The spacer's height tracks the frame's real rendered height (measured live, re-measured whenever content is added, AI generates a solution, a diagram appears, text grows). Because the spacer is normal flow content, every session below is pushed down by the browser automatically and cascades correctly through Session 2, 3, 4… No manual repositioning, and only the sessions that actually need to move move.
- **Frame-to-frame collision.** Session frames are kept in vertical order: if a growing session frame would cover a session frame below it, the lower one (and then the next, and the next) is pushed down by the exact deficit plus a small gap. The session that grew keeps its position; unrelated objects are never touched.

Both passes write coordinates in one silent transaction that is excluded from Undo history, so the automatic layout never pollutes the teacher's Undo stack and never fights an in-progress drag.

**Exception, as specified:** diagram frames are excluded from this engine. Diagrams may overlap sessions freely, and diagram-vs-diagram keeps today's behaviour.

## Acceptance checks

1. Grab any session near its top and move it in all four directions.
2. Drag a diagram with 2D mode off — it moves like an emoji, no icon appears.
3. Diagram 2D interaction still opens the panel.
4. Dragging a diagram carries its connected elements with unchanged relative positions.
5. Generating a Solution in Session 1 pushes Session 2 down instead of covering it.
6. The same with four sessions — the push cascades.
7. Classwork 1 + Classwork 2, then generate Classwork 1's solution: Classwork 2 moves down.
8. Undo still restores a completed move in one step; the sensor, AI, autosave and export are unaffected.

## Technical notes

- `src/components/lessonnotes/extensions/SectionHeading.tsx` — remove the grip button; add the pointer-down grab band on the heading wrapper (deferred drag with existing `startObjectDrag` / `detachIntoFrame`, `sectionEndWithin` still defines the session range), for every section kind.
- `src/components/lessonnotes/extensions/CanvasFrame.tsx` — add `ownerDiagramId` and a `minH` (measured height) attribute; render unchanged otherwise.
- New `src/components/lessonnotes/extensions/SessionSpacer.tsx` — invisible flow block with a `h` attribute, left behind when a session is detached.
- New `src/lib/lessonnotes/sessionLayout.ts` — measurement (ResizeObserver on session frames), spacer-height sync, and the cascading push for session frames; skips `objectKind: "diagram"`.
- `src/lib/lessonnotes/objectDrag.ts` — spacer creation on detach for session objects, and group delta application for `ownerDiagramId` frames.
- `src/components/lessonnotes/DocumentEditor.tsx` — mount the layout pass once for the editor (and the companion editor) and keep the existing left-gutter frame drag as-is.
- CSS: drop the `.lesson-solution-grip` rule, add the `cursor: grab` band; no other style changes.
