# One zoom control, on every page that shows a diagram

Every place a diagram is shown gets the same small control: **−  100%  +**. Pressing it makes that diagram bigger or smaller as a whole — lines, labels, angle arcs, right-angle markers and point dots all grow by the same factor. Nothing is stretched, nothing is displaced, and the mathematics never changes: a right-angled triangle stays a right-angled triangle at 50% and at 200%.

## What exists today

- The renderer already supports uniform zoom: it multiplies the figure's width **and** height by one factor and recomputes stroke weight, so proportions are preserved (`GeometryDiagram.tsx`, `zoom` prop).
- The Smartboard presentation passes its board zoom into that prop, so board diagrams already scale with the board.
- The lesson-note page has **−  %  +** in the ribbon, but it drives the whole paper (CSS zoom on `PageFrame`) — there is no control for one diagram on its own.
- The Geometry Properties workspace and the Teacher Smartboard Test page render the diagram with **no zoom control at all**: the figure only auto-fits its box.

## What changes

1. **A single shared zoom control** (small, quiet, professional: `−`, percentage, `+`), reused everywhere. Steps 25%, range 50%–300%, click on the percentage resets to 100%.
2. **Lesson note → diagram**: each diagram carries its own control (shown on hover/selection so the page stays clean). It stacks with the page zoom instead of fighting it.
3. **Geometry Properties workspace**: control above the canvas; the figure scales uniformly inside the existing scrollable area.
4. **Teacher Smartboard Test page** (the "test spot" page): same control in its top bar.
5. **Smartboard / Solution / Presentation diagrams**: each presented diagram gets its own control that multiplies the board zoom — the board's own zoom keeps working exactly as now.
6. Zoom is remembered per diagram, so a figure sized for teaching stays that size when the page is reopened.

Nothing else moves: no layout redesign, no change to Board A/Board B, editing, properties, highlighting, colour relationships, or floating numbers.
