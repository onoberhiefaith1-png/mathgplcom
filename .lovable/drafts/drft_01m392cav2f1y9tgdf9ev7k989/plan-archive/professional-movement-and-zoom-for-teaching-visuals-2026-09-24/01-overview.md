# Professional movement and zoom for teaching visuals

## Outcome

Upgrade native lesson-note diagrams, their Smartboard versions, and Canvas slide images so **move** and **size** are independent:

- **Move** changes where the visual sits within its permitted teaching region.
- **Zoom/resize** changes how large it is, from **50% to 500%**.
- **Document flow** always reserves the enlarged height, so later writing moves down and is never covered.
- Slide images may extend beyond the 16:9 slide; the slide clips them like a presentation viewport.

Existing diagrams, Canvas slides, media, mathematics, session order, Smartboard behaviour, and saved teacher designs remain intact.

## Confirmed starting point

- Lesson-note 2D diagrams are already real in-flow blocks and already reserve a height, but their visual zoom is only 50–300%, is remembered only in that browser, and does not increase the space reserved below the diagram.
- Smartboard diagrams reuse the native diagram renderer, but their per-diagram zoom is also browser-local and the board reserves a fixed content band, so a large figure can outgrow its allotted space.
- Canvas slide items already use one normalized 16:9 coordinate system in the editor, preview, lesson note, and Smartboard. Movement and resizing are currently clamped fully inside the slide, controls sit above the selected item, and there is no 50–500% image zoom.
- Ordinary lesson-note visuals in this scope are native diagrams; “images” here are the image/video items inside Canvas slides.

## Teacher experience

### Lesson note diagram

1. Select or interact with a diagram to reveal `− 100% +`.
2. Zoom from 50% to 500%; the figure keeps its proportions.
3. As it grows, its lesson-note block grows and pushes every following paragraph/session downward.
4. Dragging moves the figure inside its invisible authored region. Dragging cannot cross the region’s top, bottom, left, or right limits.
5. Zoom may extend beyond that normal movement region; it still cannot cover later content because the outer block reserves the required height.
6. Controls fade after 10 seconds of inactivity and return on pointer, focus, selection, drag, or zoom.

### Smartboard diagram

- It opens at the size and position saved in the lesson note.
- The teacher may then move and zoom it independently for that Smartboard presentation.
- Smartboard-only adjustments do not rewrite the lesson note.
- A ResizeObserver-driven content band grows with the rendered figure, so following board writing remains below it.

### Canvas slide image

- Selecting an image keeps its handles and toolbar available until deselection.
- A 50–500% zoom control enlarges or reduces the image independently of movement.
- Dragging may place the image partly outside the slide, and resizing may make it larger than the slide.
- The 16:9 slide remains the clipping viewport, enabling intentional full-bleed and cropped compositions.
- Editor, Preview, inline Canvas, and Smartboard use the same saved geometry and crop.
