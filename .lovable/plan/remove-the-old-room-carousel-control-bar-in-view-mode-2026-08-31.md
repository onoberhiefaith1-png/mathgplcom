# Remove the old room-carousel control bar in view mode

In view mode (`/academy`) a legacy control bar sits at the bottom: a left arrow, an "Enter <room>" button, and a right arrow. That bar is the wrong control set. The correct walking controls are the ones already used in the walkthrough (hold-to-move-forward on the right, "Turn around" on the left), as seen in the edit preview.

## What changes

- Delete the left-arrow / "Enter room" / right-arrow bar from the Academy view page.
- Keep everything else on that screen: the featured shelf strip, the Building back link, the building map, and the in-world forward / Turn around controls.
- Rooms are still entered by walking to a door in the hallway, which already works.

## Technical notes

- File: `src/pages/academy/AcademyWorldPage.tsx` — remove the bottom control-bar block (the prev/enter/next pill) and any state and imports it alone used (`focus`, `setFocus`, `ChevronRight`, and `ChevronLeft` if unused elsewhere on the page).
- No change to `HallwayScene.tsx` controls; the two-button navigation stays exactly as it is.
- Verify `/academy` still renders and walking/turning still works.
