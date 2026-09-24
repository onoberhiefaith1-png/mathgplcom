## Build plan

### 1. One visual-transform contract

Create shared rules for a visual’s authored transform:

- `zoom`: clamped to 0.5–5.0, reset at 1.0.
- `offsetX` / `offsetY`: movement inside the normal region.
- Measured natural width/height and effective rendered bounds.
- A shared 10-second activity controller for diagram controls.

Use the existing semantic buttons and icons. Zoom remains uniform, so geometry, labels, angle marks, media proportions, and mathematical meaning cannot distort.

### 2. Lesson-note diagrams: persist and reflow

Extend each native diagram node with saved `zoom`, `offsetX`, and `offsetY` attributes. Existing notes default to 100% and zero offset.

- Replace browser-only authoring zoom with the node’s saved zoom, so it follows the note across devices and into Smartboard content.
- Keep the current `height` as the teacher-defined movement region.
- Apply dragging as an internal translation, clamped against that region at the diagram’s normal footprint.
- Compute the zoomed visual’s bottom edge and reserve `max(authored region, zoomed bottom edge)` in normal document flow.
- Permit horizontal visual overflow where the teacher has enlarged the figure, while preventing any vertical overlap with the next note content.
- Reuse the existing lower barrier for changing the authored movement region; it remains separate from zoom.
- Show the zoom row on selection/activity and fade it after 10 seconds.

This preserves native editable diagram scenes and existing IDs; no diagram is rasterized or recreated.

### 3. Smartboard: inherited start, independent session state

Pass the saved lesson-note diagram transform through the existing object payload.

- Initialize each board diagram from the lesson-note `zoom` and offsets.
- Keep a separate Smartboard override keyed by diagram ID for the current board session.
- Add per-diagram selection, bounded movement, and 50–500% zoom controls with the same 10-second visibility behaviour.
- Do not write board overrides back into the lesson note.
- Measure each rendered diagram wrapper and feed the extra height into the board’s existing expandable beat/band spacing, so later lines and beats move below it.
- Keep global board zoom separate: effective size is global board zoom × diagram-authored zoom × Smartboard override.

### 4. Canvas slide images: full-bleed viewport editing

Keep the 1600×900 slide coordinate system and saved `x/y/w/h` data, but remove the assumption that all items must remain fully inside `[0,1]`.

- Movement allows negative positions and positions beyond the far edge while requiring a usable portion/centre handle to remain recoverable.
- Resize handles allow image/video items to exceed the slide dimensions up to the equivalent of 500%.
- Add `− percentage +` to the selected media toolbar. Zoom scales around the item centre and remains independent of drag.
- Move the selected-item controls to a stable editor overlay/rail anchored to the slide workspace, rather than above the image itself. They therefore remain reachable even when most of the image is outside the slide.
- Keep handles visible while selected and throughout pointer capture; deselection is the only normal way to close them.
- Use the slide itself as `overflow: hidden`, and make Preview, inline Canvas, and Smartboard consume the same out-of-bounds geometry.
- Content blocks retain their current in-slide constraints unless they are media, avoiding unintended changes to editable lesson text.

### 5. Saved slide zoom

Add an optional zoom value to saved slide items, defaulting to 100%. Existing rows and existing teacher designs remain visually unchanged. The additive data change is staged with the draft and applies only when the draft is accepted; until then, this new persistence path cannot be fully exercised against the live data.

### 6. Verification

- **Lesson note:** place text → diagram → text; test 50%, 100%, 250%, and 500%; drag to all four movement boundaries; confirm later text always moves below the rendered diagram; wait 10 seconds and confirm controls hide/reappear.
- **Persistence:** save/reopen and confirm lesson zoom/position survive; open Smartboard and confirm it starts identically.
- **Smartboard:** change only the board zoom/position, confirm later board content reflows, then reopen the lesson note and confirm its authored values did not change.
- **Slide editor:** enlarge the building image to 500%, drag it partly beyond every edge, continue using controls, and confirm intentional crop/full-bleed appearance.
- **Parity:** compare the same slide in editor, Preview, inline Canvas, and Smartboard at desktop and touch widths.
- Add focused tests for zoom clamping, movement bounds, flow-height calculation, legacy defaults, out-of-bounds slide geometry, and renderer parity.

## Not changed

- Diagram mathematics or scene coordinates.
- Canvas slide order, reveal steps, media files, or named Canvas sessions.
- Smartboard’s global page zoom, Floating Numbers, lesson-session order, or teacher-authored content.
- No new AI, asset format, or replacement images.
