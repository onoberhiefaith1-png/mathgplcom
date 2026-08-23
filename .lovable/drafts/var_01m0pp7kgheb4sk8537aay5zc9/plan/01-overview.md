# Text Rotation in the Diagram Text Panel

The Text panel already has Text, Size, Colour and Style, and a partial "Rotate" slider (−180° to 180°, step 5°). The rotation value already saves with the diagram and already renders on the note and Smartboard, because all views share one text renderer.

What is missing, and what this change delivers:

- Full **0°–360°** range with **1° steps**, plus a **numeric angle box** next to the slider so a teacher can type `90`.
- Renamed to **Rotation** and placed directly under Size/Colour, with `0°` as the default.
- Rotation pivots around the **centre of the text**, not its baseline-left anchor, so the words spin in place instead of swinging away.
- Text stays **clickable and draggable after rotation**: the click test rotates the pointer back into the text's own frame before checking the box.
- Nothing else changes: content, size, colour, position, Add/Undo/Redo, and the geometry itself are untouched, and only the selected text object rotates.
