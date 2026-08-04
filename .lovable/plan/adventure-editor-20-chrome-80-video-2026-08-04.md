# Adventure editor: 20% chrome, 80% video

Two presentation-only changes to the adventure editor (`src/pages/GameEditorPage.tsx`). No gallery behaviour changes, no new features.

## 1. Cap the top interface at 20% of the screen

Today the stack above the stage (title/back row, Hide-toolbar strip, action row with Video Background / Background / Reward / Progress Bar / Add Effect / Settings, plus the checkpoint timeline) grows as tall as its content needs — on your screen it eats close to half the window, so the video you are editing gets squeezed.

Change: wrap that whole top stack in a single container limited to 20% of the viewport height, scrolling inside itself if the buttons need more room, and give the editing stage the remaining 80%. The video canvas then always occupies the lower 80% of the screen.

The existing "Hide toolbar" fold still works — folding it gives the video even more room.

## 2. Remove Extend Canvas / Shrink from the adventure editor

These two buttons ("Extend Canvas", "Shrink") belong to the gallery workflow. They will only render when the editor is opened as a Gallery; in Adventure mode (static or video) they are removed, along with the "Canvas: N sections" counter next to them. The underlying canvas-height logic stays untouched so gallery keeps working exactly as it does now.

## Technical notes

- Group the `<header>`, fold button, action row and `CheckpointTimeline` into one wrapper with `max-h-[20vh]` + `overflow-y-auto` and `shrink-0`; the editing area below keeps `flex-1 min-h-0` so it fills the remaining ~80%.
- Change the `{!video && (...)}` guards around the canvas counter and the Extend/Shrink buttons to `{isGallery && ...}`.
- Fullscreen mode path is unchanged.
