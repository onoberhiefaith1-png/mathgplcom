# 2D Diagram Workspace — bounded drawing area, barrier controls, clean points

Fix the 2D geometry workspace so the yellow barriers define the drawing space, the workspace opens where the cursor is, and points/labels stay hidden unless the teacher asks for them. Existing geometry tools keep working.

## 1. Barriers are the boundary

- Clicking 2D opens a fixed upper barrier and a movable lower barrier, both stretching the full width of the lesson-note page.
- Everything between them is the drawable region; drawing is allowed anywhere inside it, not only inside the old rectangle.
- The rectangular outline currently drawn around the figure stops acting as a boundary: no visible frame, and the drawing surface fills the barrier region's full width and height.
- Barriers stay visible while 2D mode is on for the active workspace, and are never part of saved or printed lesson content.

## 2. Lower barrier controls

A small control group sits on the lower barrier with: move up, move down, drag handle, and delete.

- Moving down enlarges the region; every following lesson item (text, sections, tests, exercises) shifts down with it because the region reserves real document height.
- Moving up shrinks it and the content below returns.
- The lower barrier can never rise above the upper barrier (a minimum region height is enforced).

## 3. Opens at the cursor

- 2D opens the workspace at the current caret/sensor position — e.g. directly under "Solution 1" — instead of jumping to an existing figure at the top of the note.
- Reuse of an existing figure only happens when the cursor is already inside/next to that figure.

## 4. Delete / exit

- The delete control removes the workspace: both barriers, the movement controls and the drawing surface disappear and the note returns to its normal layout with all text intact.
- Leaving 2D mode also removes the barrier chrome without touching lesson content.

## 5. Remove AI Edit from the diagram strip

The AI Edit button under the diagram is removed. Zoom, copy and delete remain.

## 6. Point behaviour — Align / Disalign

A single Point control sits beside the geometry tools with two states:

- Disalign Point (default): drawing a line, circle, arc or curve produces clean geometry. The helper points used to build it are not shown and get no A/B/C labels. The geometry itself keeps its points internally so measurement, selection, dragging and calculations still work.
- Align Point: points are visible and labelled as they are today, and two lines meeting at the same spot share one point instead of creating two near-identical ones.

Switching between states at any time only changes visibility/labelling — it never deletes or alters an existing diagram.

## 7. Preserved

Select, Point, Line, Circle, Arc, Curve, Add Text, Add Distance, Add Angle, Add Area, plus properties, measurements, movement, selection, editing and annotations all keep working inside the new bounded region.

## Technical notes

- `src/components/lessonnotes/extensions/GeometryDiagram.tsx`: barriers become full-page-width rules (yellow/amber token), always shown in 2D mode for the active node; add up/down/delete buttons next to the existing drag grip; drop the AI Edit button; make the inner wrapper fill the barrier region width/height; remove the fixed-size letterboxed look so drawing maps across the whole region.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` + the SVG renderer it wraps: size the surface from the region box instead of the scene bounding box, and suppress the visible outline.
- `src/components/lessonnotes/DocumentEditor.tsx` → `ensureGeometryRegion`: insert at the caret first; only reuse a figure when it is at/adjacent to the caret (drop the "first diagram owned by this question" lookup for the create path).
- Point visibility: add a `showPoints` flag on the geometry mode context (persisted per diagram scene meta so it survives reopen), default off. Construction points created by `addPoint`/`ensurePointLocal` get `hidden: true` and no auto label when off; `nextPointLabel` is only applied when on. Rendering and label pickers in `snap.ts`/renderer already respect `hidden` and empty `label`, so hit-testing for real points continues to work. Toggling on reveals points and assigns labels lazily; toggling off hides them again without mutating structure.
- `GeometryToolbox`/`GeometryToolbar`: add the Align Point / Disalign Point toggle beside the tool list.
- Barrier state stays in node attrs (`height`) — mode-only chrome is never serialized.
