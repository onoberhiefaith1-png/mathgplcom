# Smart Screen Video — Fix the Existing Behaviour

Only the Smart Screen video behaviour and the room control overlay's visibility change. Classroom shells, navigation math, doors, materials, lighting, camera rig and the Building Map stay as they are. Live camera stays out.

## 1. The TV frame is a placeholder only

Today the screen always draws a recessed black housing, a bezel and a standby caption, and the video is painted onto the glass inside that frame.

Change: when the room's screen has a video, the placeholder layers disappear — no housing, no bezel, no standby caption, no dark backing. Only the video surface remains, sitting exactly where the screen was on the front wall, at the same size and position. With no video, the placeholder returns unchanged (dark panel + room name caption).

The video stays a wall-mounted 3D object. It is never a floating popup or a DOM overlay.

## 2. Automatic playback in View mode

Entering a classroom that has a video starts playback immediately, muted (browsers only allow muted autoplay). No Play click required. Volume/unmute is one tap in the player bar.

## 3. Video controls always reachable in View mode

The playback bar (play/pause, back 10s, forward 10s, timeline with elapsed/total, mute, volume) appears on entry whenever a video exists, instead of only after clicking the screen. Clicking the screen still toggles the bar. Edit mode is unchanged: clicking the screen opens the Smart Screen panel with Upload / Replace / Remove.

## 4. Edit mode (unchanged, verified)

Edit → click Smart Screen → Upload Video → file picker → saved to that classroom's screen record and storage → available in View mode. No live camera option.

## 5. Navigation controls auto-hide after 10 seconds

Room navigation (walk, turn, step, Leave) and the room-name/hint pills fade out after 10 seconds of no interaction, and come straight back on any pointer, touch, drag or key input inside the room. The video player bar is a separate overlay with its own visibility and is not merged with navigation.

## 6. Walking up to the screen

Movement already gives true 3D perspective, so approaching the wall naturally grows the screen. The room's wall clamp is relaxed slightly on the teaching wall so a student can stand close enough for the video to fill the viewport, with the classroom naturally out of frame. Walking back shrinks it again. No digital zoom is added.

## Technical notes

- `src/components/academy/world/SmartScreen.tsx`: gate housing/bezel/standby text on `hasContent`; keep the rounded glass mesh as the video plane; keep the click handler on it in both states.
- `src/hooks/useRoomScreen.ts`: keep existing muted-autoplay load path; ensure playback resumes when the room mounts with an existing `video_path`.
- `src/components/academy/world/HallwayScene.tsx`: render `SmartScreenControls` open-by-default in view mode when a video exists; wrap `RoomControls` and the room pills in `useAutoHide(10000)` with `ping()` wired to room pointer/key handlers; small teaching-wall clamp adjustment.
- `src/components/academy/world/SmartScreenControls.tsx`: unchanged edit panel; view bar gains no new controls, only different visibility.
