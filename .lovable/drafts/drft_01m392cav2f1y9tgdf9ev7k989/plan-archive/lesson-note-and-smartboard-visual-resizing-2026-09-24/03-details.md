# Implementation details

## 1. Preserve Canvas/Edit and make its saved state authoritative
- Keep the current Canvas selection, drag, resize handles, fill-frame action, cropping, and zoom controls unchanged.
- Activate durable storage for each slide item's zoom, with a safe 100% default for every existing item.
- Continue using the shared 1600×900 slide coordinate system and the same media renderer everywhere.
- Ensure reads and writes preserve position, dimensions, zoom, reveal step, stacking order, and aspect ratio without a legacy fallback silently discarding zoom.

The additive data change is already staged. Because this is a draft, it takes effect only when the draft is accepted.

## 2. Resize the whole Canvas presentation inside Lesson Notes
- Extend the embedded Canvas object with saved uniform scale and bounded position, without exposing individual slide-image editing.
- Add `− 100% +` controls for the whole presentation, from 50% to 500%, visible on selection or interaction and fading after about 10 seconds.
- Keep the presentation at 16:9. Scale width and height together; never stretch either axis independently.
- Treat the presentation as a document-flow object: calculate its displayed height from its 16:9 dimensions and zoom, include downward offset, and reserve that full height so subsequent text moves down.
- Keep drag within invisible document boundaries. Zoom can make the presentation wider/larger than its normal movement region while its reserved vertical space continues growing.
- Keep slide navigation controls functional and separate from drag/zoom controls.

## 3. Complete native diagram behavior
- Retain the existing saved 50–500% uniform zoom and saved bounded offsets.
- Tighten selection and inactivity behavior so controls reliably reappear on select, drag, zoom, or pointer activity, then fade after 10 seconds.
- Verify legacy diagrams default to 100% with unchanged position and that their computed flow height always includes zoom and positive vertical movement.

## 4. Smartboard inheritance and independent adjustment
- Canvas presentations must render from the same saved slide rows and shared renderer used by Canvas/Edit—never rebuild from imported image dimensions or apply a second default sizing rule.
- Initialize the Smartboard from the saved Canvas item state and the saved whole-presentation Lesson Note scale/position.
- Add temporary Smartboard-only whole-presentation zoom and bounded drag. These adjustments reset with the board session and do not overwrite Canvas or Lesson Note design.
- Keep native diagram inheritance: saved Lesson Note zoom/offset is the initial state, multiplied/augmented by board-only zoom/drag.
- Use measured rendered height in every active Smartboard object-flow path so enlarged or downward-moved visuals push later rows/content down. Consolidate the existing ad-hoc offset-only reservation onto the same flow-height rule where needed.

## 5. Compatibility and safeguards
- No destructive data change and no replacement of existing assets.
- Existing slide items receive a 100% zoom default.
- Existing Canvas embeddings retain their current appearance at 100%.
- Saved geometry scenes and teacher-authored diagram transforms remain unchanged.
- Canvas/Edit behavior gets regression coverage rather than interaction changes.

## Acceptance tests
1. **Canvas → Smartboard:** import a landscape image, make it cover the 16:9 Canvas, save, exit, and open Smartboard. Position, crop/frame coverage, proportions, and zoom must match exactly.
2. **Lesson Note whole Canvas:** select the embedded presentation, enlarge it to 200% and 300%, confirm 16:9 proportions, slide navigation, and that all following content moves down with no overlap.
3. **Lesson Note diagram:** enlarge a native diagram through 200%, 300%, and up to 500%; confirm proportional geometry, bounded drag, saved state after reload, and document reflow.
4. **Smartboard Canvas:** confirm inherited frame coverage, then change board-only zoom and drag; confirm proportional rendering, bounded movement, downward reflow, and no write-back to Canvas/Edit.
5. **Smartboard diagram:** confirm inherited Lesson Note transform, independent 50–500% board zoom, bounded movement, and reflow in each Smartboard rendering path.
6. **Controls:** verify controls appear on selection/activity, remain usable during movement, fade after about 10 seconds, and reappear immediately on interaction.
7. **Regression:** verify existing named Canvases, multiple slides, videos, reveal steps, chevrons, saved diagrams, and legacy 100% items still render correctly.
