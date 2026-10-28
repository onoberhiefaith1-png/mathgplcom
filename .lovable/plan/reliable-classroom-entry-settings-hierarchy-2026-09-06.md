# Reliable classroom entry + settings hierarchy

Two changes: make clicking a classroom door always end up inside the room, and move Frames and Windows up into the main building-structure settings.

## 1. Clicking a door always enters the room

Today the entry works in two stages: a camera glide toward the doorway, and then a callback at the end of that glide that actually puts you inside the room. If anything interrupts that glide — you press forward, another door is clicked, the view resets, or the room has to be re-read from the database — the final step never runs and you are left standing at the doorway. That matches the behaviour being reported.

New behaviour:

- Entering a room becomes a navigation move like turning, with its own destination recorded up front: the room, the spot to stand on inside it, and the direction to face. It is worked out before any camera movement starts, never from animation state.
- Once a click is accepted, that destination is committed. The camera glide is only a visual transition; when it finishes, is cut short, or is interrupted, the walker is still placed inside the room at the recorded spot.
- A safety timer guarantees arrival: if the transition has not completed shortly after it should have, the walker is placed inside immediately.
- Repeat clicks on the same door, or a click while another transition is running, resolve to the same destination instead of cancelling entry.
- Doors with no room attached still say so and do nothing else.
- The lock stays exactly as it is and remains the only thing that can stop entry: a locked room still sends you to the keypad, and once unlocked the door always enters.
- Leaving the room, and forward/back/left/right movement inside it, stay unchanged.

Verification: log in, walk the building and enter every classroom door, click the same door repeatedly, enter from different distances, enter after unlocking with a code, leave and re-enter, and move around inside — with screenshots at each step.

## 2. Settings order

Frames and Windows currently sit as their own panels below "Hallways & rooms". They move up into the same continuous structure list, with no duplication and no change to how they work:

```text
Start Point
Terminal Wall
Ceiling
Doors
Frames
Windows
Lighting
Effects
Save Changes
--------------------
Hallways & rooms
```

The existing Frames and Windows editors are reused as-is in their new position; the old lower panels are removed so each appears once. Save stays after Effects, and "Hallways & rooms" remains its own section below.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx`: add a room-entry destination record (`classroom`, entry offset from `classroomDimensions`, heading derived from the door's inward normal). `openDoorRoom` resolves the room first (cache, then `fetchRoomForDoor`), commits the destination to a ref, then starts the cosmetic zoom. `enterClassroom` is called by whichever happens first: zoom `onDone`, zoom interruption in `startDoorZoom`/`backToBrowse`, or a watchdog in the frame loop keyed on committed-destination age. Guard against double entry by clearing the committed ref on arrival. Keep `lockForDoor` / `focusLockPanel` / `unlockedRooms` untouched, and keep the pick-distance and `doorFacesCamera` guards.
- `src/components/academy/editor/BuildingSettingsPanel.tsx`: accept optional `framesSection` / `windowsSection` React nodes and render them as collapsible sections between Doors and Lighting, above the Save button.
- `src/pages/academy/AcademyEditorPage.tsx`: pass the existing `FrameManager` (`kind="frame"`) and `FrameManager` (`kind="window"`) instances into those slots and delete the two standalone accordions below "Hallways & rooms", keeping their open/closed state keys.
