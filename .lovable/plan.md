# Move the lock onto the room, and let it be set while creating a room

The lock stops being a door thing and becomes a room thing. A room and its entrance are one object, so the lock belongs to the room and is simply shown on the wall beside that room's entrance.

## 1. Lock belongs to the room

The stored lock is keyed to the room (Classroom / Teaching Hall / Auditorium) instead of the door. Nothing changes visually in the world: the access panel still appears immediately to the right of that room's entrance, because the entrance is the room's own door.

## 2. Lock in the room's settings list

In Environment, after picking a room in "Settings for" (e.g. Classroom · xxx), the section list becomes:

```text
Walls
Floor
Start Point
Terminal Wall
Ceiling
Doors
Lock          <- new, room only
Lighting
Effects
```

The Lock section shows:
- No lock yet: "Add Lock" with code characters (numbers / letters / both), code length, code, and confirm code.
- Lock exists: "Locked · N characters", Change code (code + confirm), and Remove Lock.

When "Settings for" is Default Settings or a hallway, the Lock section is not offered — a lock is never a building-wide default.

## 3. Lock while creating a room

The Add Room wizard gains a final optional step after the room name:

```text
Hallway -> Room type -> Name -> Lock (optional)
```

On that step the teacher can either skip (room is unlocked, exactly as today) or add a lock: choose characters and length, type the code, then type it again to confirm. The room and its lock are created together; if the lock fails to save, the room creation is rolled back so there is never a half-made room.

Codes must be typed twice and match everywhere they are set, in creation and in settings.

## 4. Student side (unchanged behaviour)

A locked room's entrance shows the wall panel; the correct code opens the room, a wrong code shows "Incorrect access code" on the panel. Unlocked rooms behave exactly as before.

## Technical notes

- Migration: rebuild the new, still-unused `building_door_locks` table as `building_room_locks` keyed by `classroom_id` (unique, cascade delete with the room), keeping `code_hash`, `charset`, `code_length`, RLS, GRANTs, and editor-only writes. Deleting a room removes its lock automatically.
- `src/lib/building/lock.ts`: index locks by `classroom_id`; keep the pure code/charset/keypad helpers as they are, and add a "codes must match" check for the confirm field.
- `src/lib/building/lock.functions.ts`: `setRoomLock`, `removeRoomLock`, `verifyRoomLock` take a room id; editor permission is checked through the room's building.
- `src/lib/building/api.ts` / `types.ts`: `BuildingData.locks` carries room-keyed metadata only (`id, building_id, classroom_id, charset, code_length`) — never the hash.
- `HallwayScene.tsx`: resolve the lock through the room attached to the clicked door (`roomForDoor`), so the gate and panel stay where they are; `DoorLockPanel` itself is untouched.
- `BuildingSettingsPanel.tsx`: add a `Lock` section between `Doors` and `Lighting`, rendered only when the active scope is `classroom:*`, driven by new optional props (`roomLock`, `onSetRoomLock`, `onRemoveRoomLock`) wired from `AcademyEditorPage.tsx`.
- `WalkwayManager.tsx`: add the optional lock step to the Add Room wizard and pass lock fields through `onAddRoom`; remove the per-door-row lock control added earlier (`DoorLockSettings` becomes the shared room-lock form used by both the wizard and the settings section).
- Hallway navigation, door movement, room shells, Smart Screen and Building Map logic are untouched.
