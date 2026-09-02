# Make the Smart Screen itself the clickable object

The black screen in every room already exists and already has an upload/replace/remove pipeline behind it — but nothing opens it: the panel is a separate button floating top-right, and the screen mesh's click handler is never connected. This plan wires the screen to its own settings, and splits Edit Mode from View Mode.

## What changes

1. **Clicking the screen opens its own panel.** The screen mesh becomes the trigger. No new screen, no move, no resize, no extra button in the room.
2. **Edit Mode (authorised editors only)** — clicking the screen opens a small "Smart Screen" panel anchored over the view:
   - Primary action: **Upload Video** → opens the device file picker → uploads and attaches the video to *this* classroom's screen.
   - Once a video exists, the panel shows its file name plus **Replace Video** and **Remove Video**.
   - Upload progress and errors stay in the panel.
3. **View Mode (everyone else)** — clicking the screen never shows upload controls:
   - With a video: the playback bar appears (Play/Pause, −10s/+10s, timeline, volume/mute) and the video plays on the screen glass.
   - With no video: the screen stays blank and clicking it does nothing.
4. **Camera / live broadcast stays out.** The existing camera buttons are hidden in this version; the underlying code is left in place, unused.

## Technical notes

- `HallwayScene.tsx` gains an `editing?: boolean` prop, passed `true` only from `AcademyEditorPage.tsx` (`/academy/edit`). `AcademyWorldPage.tsx` stays view mode. Effective editor access = `editing && building.canEdit`.
- `ClassroomShell.tsx` forwards a new `onScreenSelect` prop into the existing `SmartScreen` `onSelect` handler (already declared, currently unused). Geometry, size and position of `SmartScreen.tsx` are untouched.
- `HallwayScene.tsx` holds `screenPanel` open/closed state: clicking the glass toggles it; leaving the room resets it.
- `SmartScreenControls.tsx` is re-scoped to a controlled surface:
  - `open` + `onClose` props instead of its own internal toggle button;
  - editor panel rendered only when `canEdit && editing`, with Upload / Replace / Remove and the current video name;
  - viewer bar rendered only when a video exists and the user opened it, hidden for editors while the editor panel is open;
  - camera buttons removed from the UI.
- `useRoomScreen.ts` / `screen.ts` / the `building_room_screens` table need no changes — upload, replace, remove and per-classroom storage are already implemented and per-room scoped.

## Verification

TypeScript check, then authenticated preview at 1280x1800: enter a room from `/academy/edit`, click the black screen, confirm the panel with Upload Video appears; then load the same room from `/academy` and confirm clicking the screen offers playback only, with no upload controls.
