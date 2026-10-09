# Make the 2D editing lines reliable on every diagram

## What the two lines are
The two horizontal lines are the **2D editing region** of a diagram. Everything between them is the drawing surface; the lower line can be dragged to make the region taller. They are editing aids only — never saved or printed.

## Why it breaks today
The lines (and the live drawing tools) only appear while the note's own text cursor has the diagram "selected". That selection is fragile: clicking a tool in the left Geometry panel, clicking inside the drawing, or the note moving its cursor makes it drop. The moment it drops, the lines vanish and the diagram falls back to a picture you can't edit. Clicking an existing diagram sometimes never gets that selection at all — so it looks dead.

## The fix
While **Geometry → 2D is on**, the diagram you click becomes the *active diagram* and stays active until you:
- click a different diagram (that one becomes active), or
- turn Geometry/2D off.

Clicking toolbox tools, drawing, typing labels, or using the Properties panel no longer removes the lines. Every existing diagram opens with both lines above and below it, ready to edit, and a fresh 2D spot behaves as it does now.

Outside 2D mode nothing changes: diagrams stay view-only and movable as before.
