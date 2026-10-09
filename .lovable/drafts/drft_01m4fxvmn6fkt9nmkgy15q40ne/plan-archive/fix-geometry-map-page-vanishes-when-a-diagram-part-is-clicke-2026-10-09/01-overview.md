# Fix: Geometry Map page vanishes when a diagram part is clicked

## What happens
In the Geometry Map workspace, with "Picking from diagram" on, clicking a line, point or angle should drop a reference box into the property editor and colour that part. Instead the whole page disappears.

## What the logs show
- No crash message was recorded. Instead the browser froze for about 3 seconds right as you clicked, which points to a loop of repeated work rather than a single error.
- A click on the diagram triggers two things at once: the part gets an automatic colour (which changes the saved diagram), and a reference box goes into the editor. The colour change refreshes the diagram, which re-arms the picker and refreshes the highlight — a likely loop. A second suspect: the diagram change rebuilds the lesson-note block underneath, which closes the workspace page that sits on top of it.

The exact cause is not confirmed yet, so step 1 is to reproduce it.

## Steps
1. Reproduce in a test browser on this lesson note: open Geometry Map, click a side and a corner, and record whether the page reloads, the workspace closes, or the browser freezes.
2. Stop the loop: only colour a part the first time it is picked, and don't re-arm the picker or redo the highlight when the colour changes.
3. Keep the workspace open while the diagram updates, so a colour or link change can never close it.
4. Add a safety net to the workspace so any future error shows a "Something went wrong — back to lesson note" message and keeps your work, instead of a blank page.
5. Check again: click 5 parts in a row — each adds one box, gets its colour, lights up, and the page stays open. Add Property and Back to Lesson Note keep working.
