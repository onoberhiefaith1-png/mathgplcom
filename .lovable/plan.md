# Full-screen the teaching video editor

Today the only full-screen control lives on the black player area, is hidden until a video is uploaded, and only expands the video itself — so in your screenshot there is no visible button.

## What changes

- A clearly visible expand/collapse icon button in the dialog header, next to "Teaching video — Question 1" (left of the close X).
- Pressing it makes the **whole editor** fill the screen: player on top plus the full scrolling line list with all start/end fields.
- Pressing again (or Escape) returns to the normal windowed dialog. Escape in full screen collapses first instead of closing the editor.
- The button is always available, even before a video is uploaded.
- In expanded mode the player region gets more height so timing is easier to judge; the line list keeps its own independent scroll.

## Technical notes

- In `src/components/coursebuilder/QuestionVideoEditor.tsx`: replace the player-only `requestFullscreen` toggle with an `expanded` state applied to `DialogContent` (full viewport width/height, no max-width, minimal rounding) so dialog chrome and layout stay under React control.
- Header gets the `Maximize2`/`Minimize2` button; remove the overlay button from the player, or keep it wired to the same state.
- Player max-height becomes conditional on `expanded`; the scroll container keeps `flex-1 overflow-y-auto`.
- Intercept `onOpenChange`/keydown so Escape collapses when expanded.
- No changes to segment data, boundary logic, or save behaviour.
