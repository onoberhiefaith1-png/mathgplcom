## Technical detail

All work is in `src/components/lessonnotes/slides/CanvasSlideViewer.tsx`, the one viewer shared by the lesson note and the Smartboard. Canvas/Edit (`SlideCanvas.tsx`, `SlidePanel.tsx`) is not touched.

**1. Restructure the viewer into two layers**
- Outer host: full note width, `position: relative`, keeps `paddingTop = offsetY` so enlarging still pushes following content down.
- Picture layer: the current `width = scale * visualZoom` box, now a child that may overflow horizontally (`overflow-hidden` on the host's inner track so an over-100% picture crops instead of widening the page).
- Control layer: absolutely positioned against the host — left chevron at `left-0`, right chevron at `right-0`, zoom badge top-right, counter bottom-left. They no longer sit in the flex row that scales, so neither arrow can be pushed off screen at 200–500%.

**2. Zoom badge behaviour**
- Position fixed to the host's top-right corner (independent of `visualZoom`).
- `useHoverIdleVisibility({ idleMs: 10000, hideWhileInside: true })` stays, and `ping()` is already called on every zoom step, so it cannot fade while the teacher is stepping the percentage up; it only fades after 10s idle and returns on pointer/selection.
- Keep `presentation` sizing (larger hit areas) and the existing rule that board zoom multiplies the authored zoom without writing back.

**3. Blank Canvas in the lesson note**
Cause is not yet confirmed — the same component renders correctly in presentation. First step is to reproduce in the note and read which of these it is:
- the node view's measuring box reports width 0 at mount, so `fit` never updates and the stage renders at the wrong scale;
- items load but the signed media URL request is cancelled by the node view remounting on every editor transaction;
- the embed carries a `canvasId` whose slides resolve empty in the editor context.

Then fix that specific cause (most likely: memoise the viewer per `canvasId` so editor transactions don't remount it, and re-measure `fit` via `ResizeObserver` on the host rather than the inner box).

**Verification**
- In a lesson note: step Next through all three slides, confirm pictures render, take zoom 100% → 200% → 300% and confirm both arrows and the badge stay in place and the text below moves down, not under the picture.
- On the Smartboard: same three slides, Next works, zoom reachable at 300%.
