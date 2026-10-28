## Technical details

- **New `CanvasFullscreen.tsx`** (in `lessonnotes/slides/`) opens as a layer over `document.body` (`fixed inset-0 z-[10000]`, black background) and calls `requestFullscreen` if the browser allows it. It loads the slide items with `listSlideItems`. Each image or video is drawn with `SlideMedia` using `object-contain` at the full screen size, so the Canvas frame and its cropping are skipped entirely.
- The zoom is local to this layer, using `clampVisualZoom` (0.5–5). Buttons and the wheel change the zoom, and pinch uses pointer events. You pan by dragging with pointer events and a `translate` transform. Zoom and position reset when the slide changes.
- **Controls:**
  - Chevrons are fixed at the left and right middle of the screen.
  - The `DiagramZoomControl` sits fixed at the bottom centre.
  - The X is fixed at the top right.
  - Keyboard: ArrowLeft and ArrowRight change the slide, and `useEscapeClose` closes the layer.
  - The controls fade after 10 seconds without activity (`useHoverIdleVisibility`).
- **`CanvasSlideViewer.tsx`, presentation mode only:** add a pinned "Full screen" button (Maximize2 icon) to the fixed control layer. It opens `CanvasFullscreen` on the current slide index. On close, the viewer syncs to the last slide shown.
- No changes to `SlideCanvas`, `SlidePanel`, the Lesson Note view, the saved data or the database.
- **Verify** with Playwright on `/smartboard/13a25521-…?from=note`:
  - the button shows
  - the layer covers the viewport
  - Next and Previous work
  - zoom and drag work
  - Escape and X return to the Smartboard
