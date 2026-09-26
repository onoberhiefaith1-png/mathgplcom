## Build steps

### 1. Add the structural Canvas session

- Add `canvas` to the lesson section vocabulary, exact structural recognition, labels, insertion options, outline navigation, and document sync compatibility.
- Insert a stamped level-2 `Canvas` heading with no generated paragraph requirements, no question ID, no Solution placeholder, no AI/Floating Numbers controls, and no “add another question” behavior.
- Give Canvas headings persistent presentation-reference attributes in the lesson document so the same session identity survives save/load, duplication, and Smartboard mirroring.
- Render a dedicated Canvas-session gateway below the heading. It lists the lesson’s Canvases in a bounded, vertically scrollable selector and remembers the selected Canvas for that session.
- Keep the existing toolbar entry as a shortcut to the same Canvas manager, avoiding two separate implementations.

### 2. Consolidate Canvas management

- Refactor the current panel into reusable selector, manager, slide strip, scene renderer, and player pieces.
- Canvas selector: create, select, rename from settings, and delete; support long lists without expanding the lesson page indefinitely.
- Slide manager: thumbnail/number strip, select, rename, add, delete, and immediate reorder.
- Remove Capture and Screenshot controls and their overlays from the Canvas interface only. Keep those utilities elsewhere untouched.
- Keep **Import Image**, **Import Video**, and **Add Slide**. Add media replacement from the selected item/slide editor.
- Preserve existing image/video drag, eight-handle resize, fit/fill/reset tools, signed media loading, and stored slide order.

### 3. Make 16:9 the single geometry contract

- Replace the portrait logical page with a landscape 16:9 coordinate space and centralize that geometry in one Canvas-scene module.
- Continue storing object positions and sizes as normalized values (`0..1`), so all screen sizes use identical placement.
- Use the same scene component for editing, Preview, embedded lesson playback, and Smartboard; editing adds selection handles while presentation removes editing controls.
- Fit the complete 16:9 frame into available space without changing its internal coordinates. Images/videos use aspect-preserving contain by default, with explicit Fill Canvas available when the teacher wants edge-to-edge content.
- Treat existing saved media as existing normalized objects; do not delete, flatten, or re-upload teacher content. Add regression checks around legacy loading and visible bounds.

### 4. Presentation controls and media behavior

- Replace visible Previous/Next text buttons with one large integrated chevron on each side of the scene.
- Disable the left arrow on slide 1 and right arrow on the final slide; show a quiet `n / total` indicator.
- Support click, touch, `ArrowLeft`, `ArrowRight`, and Escape in full-screen Preview. Space may advance in Preview without adding visible text controls.
- Videos retain aspect ratio and standard playback controls. Leaving a video slide pauses it; returning does not create duplicate playback. Media loading failures remain explicit and retryable.
- Keep full-screen Preview and return to the same Canvas and slide on exit.

### 5. Smartboard and lesson-flow integration

- Stop Smartboard from loading every lesson slide as one flat sequence. It selects the Canvas presentation referenced by the active Canvas session, then loads only that Canvas’s ordered slides.
- Display the Canvas directly when lesson navigation reaches its session, without converting it into a Diagram or Solution beat.
- Use the shared 16:9 player and chevrons in both the embedded lesson and Smartboard presentation.
- Preserve all existing question → Solution pairing, Floating Numbers, diagram, writing, and board-navigation behavior outside Canvas sessions.

## Technical details

- Reuse the existing Canvas, slide, item, and private-media records; no replacement content model is needed.
- Extend heading attributes for the Canvas session stamp/reference and persist them in the existing lesson document JSON. Avoid a database migration unless implementation inspection proves document persistence cannot safely carry the reference.
- Split the current `SlideCanvas` responsibilities so editor chrome wraps a shared pure scene renderer also used by `SlidePlayer`.
- Change Smartboard retrieval from lesson-wide `listSlides(notebookId)` to Canvas-aware `listCanvases` + `listCanvasSlides(canvasId)`.
- Keep future fields such as duration, autoplay, and loop out of the active interface, but keep player state and slide records extensible so those can be added without changing the three-level model.

## Verification

1. Insert Canvas between Explanation and Example; confirm no Solution is created and lesson order remains intact after reload.
2. Create at least 20 named Canvases; verify the selector scrolls and renaming does not alter the `Canvas` session heading.
3. In one Canvas, create, rename, reorder, and delete slides; import both image and video media and replace each.
4. Resize/reposition media, use Fit/Fill/Reset, reload, and confirm saved geometry remains visible.
5. Compare screenshots of the same slide in editor, Preview, embedded lesson playback, and Smartboard at desktop, tablet, and 16:9 board sizes; placement must match.
6. Verify only chevrons and the subtle count appear while presenting; first/last disabled states, keyboard input, touch targets, video pause, and Escape all work.
7. Place multiple Canvas sessions at different lesson positions and bind/select different presentations; confirm each opens the intended slides.
8. Run lesson/session, slide persistence, media, Smartboard, and existing question/Solution regression tests. Browser-test the complete teacher flow with a real image and video.

## Not included

- AI generation of slides or mathematical animations.
- Autoplay, duration, pause schedules, or looping.
- Changes to Diagram, Solution, Floating Numbers, AI Edit, lesson generation, or mathematics behavior.
