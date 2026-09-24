# Lesson Note and Smartboard visual resizing

## Goal
Keep the working Canvas/Edit experience unchanged, then make the selected **whole Canvas presentation** and native diagrams behave as scalable teaching objects in Lesson Notes and Smartboard.

- **Canvas/Edit:** remains a fixed 16:9 viewport. Images and videos retain the current drag, resize, crop, fill-frame, and 50–500% zoom behavior.
- **Lesson Notes:** the whole selected Canvas presentation can be moved and resized as one proportional 16:9 document object. Native diagrams keep proportional 50–500% zoom. Enlarging either object increases its reserved document height and pushes later content down.
- **Smartboard:** starts from the exact saved Lesson Note/Canvas state, then allows temporary board-only movement and zoom without writing those adjustments back.

## Confirmed current state
- Canvas editing, embedded playback, and Smartboard playback already share the same 1600×900 coordinate system and media renderer.
- Saved Canvas item position and dimensions already travel between those surfaces.
- Canvas item zoom is present in the app code but the live data does not yet contain its storage field, so custom zoom currently falls back to 100% after reload.
- Native Lesson Note diagrams already save zoom and offsets, preserve proportions, and reserve more document height when enlarged.
- The Canvas presentation embedded in a Lesson Note currently has only a 30–100% width setting; it has no matching move/zoom controls.

## Resolved behavior
The Lesson Note controls resize the **whole Canvas presentation**, not individual images inside its slides. Editing an individual slide image remains exclusively in Canvas/Edit.

## Non-negotiable protections
- Do not alter Canvas/Edit interaction behavior.
- Never distort visuals: one uniform scale controls both dimensions.
- Dragging remains bounded; zoom may exceed ordinary movement bounds.
- Enlarged Lesson Note and Smartboard objects must never cover following content.
- Existing saved diagrams, Canvases, slides, and teacher layouts remain compatible.
