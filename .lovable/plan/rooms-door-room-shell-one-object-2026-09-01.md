# Rooms = Door + Room Shell (one object)

Simplify building creation to two actions: **Add Hallway** (unchanged) and **Add Room** (creates a door and its room shell together). A door becomes strictly a room entrance — never a shortcut to a course, assignment, adventure or smartboard.

## 1. Settings → Add

- Keep **Add Hallway** exactly as it is (creation, junction side, merging, map).
- Remove **Add Door** and **Add Classroom** (including the per-hallway "Add Door here" chip is replaced by "Add Room here").
- New **Add Room** wizard, one step at a time:
  1. Hallway (only hallways with wall capacity are offered, as today)
  2. Room type — Classroom / Teaching Hall / Auditorium
  3. Room name (e.g. `JG`), optional door design
  4. Create → door + room created together, room selected

The wizard never creates a door on its own and never creates a room without a door.

## 2. A door is only an entrance

- Entering a door always opens the room attached to it. The product-launch path (course/game/adventure/assessment) is removed from door entry.
- Door plaque text becomes the room: `CLASSROOM · JG`, `TEACHING HALL · MN`, `AUDITORIUM · AB`.
- Existing doors: a one-off backfill attaches a default **Classroom** shell (named from the door's current title) to every door that has none, so no door is left roomless. The old content columns stay on the table but are no longer read for navigation, so nothing else that references them breaks.
- Courses/assignments/adventures/smartboard are not touched — they will later be placed inside rooms.

## 3. Room list / editing

The doors list in Settings becomes a **Rooms** list: room name (editable), room type (changeable between the three types), door design, position along the hallway, delete. Deleting a room deletes its door too, since they are one object. Changing type never moves the door.

## 4. Building Map

Each room is drawn on the plan as one connected unit:

```text
        ┌──────────┐
hallway ─┤  ROOM    │   label: CLASSROOM – JG
   ──────┴──────────┘
        ^ door stub
```

- Footprint scaled from the real shell dimensions: compact square (Classroom), long rectangle (Teaching Hall), wide stepped block with the front presentation strip marked (Auditorium).
- The footprint sits on the correct side of the hallway, joined to its door by a short stub, with the label `TYPE – NAME`.
- Existing map behaviour (zoom, follow, route highlight, endpoints) is unchanged.

## 5. Room shell

Unchanged and still empty: walls, floor, ceiling, doorway back to the hallway. No windows, smartboard, furniture, frames or decorations.

## Technical notes

- `src/lib/building/api.ts`: new `addRoom(buildingId, walkwayId, { position_along, kind, name, style })` — inserts the door, then the `building_classrooms` row, and deletes the door again if the room insert fails so a naked door is never left behind. Add `deleteRoom(doorId)`.
- `src/components/academy/editor/WalkwayManager.tsx`: replace the `door` and `classroom` forms with one `room` wizard; rename the per-hallway chip; convert the door rows into room rows with a type selector. Reuse the existing `nextSlot` / `remainingSlots` capacity logic unchanged so a room can never land inside a junction throat.
- `src/pages/academy/AcademyEditorPage.tsx`: `handleAddRoom` replaces `handleAddDoor`; drop the product catalogue wiring from door creation; keep classroom overrides/settings entries as they are.
- `src/components/academy/world/HallwayScene.tsx`: `DoorMesh.onEnter` always calls `enterClassroom` for the attached room; drop the `onOpenDoor` product branch; sublabel from room type; `MiniMap` gains room footprints + labels derived from `classroomDimensions(kind)`.
- One migration for the backfill (default Classroom per roomless door). No schema change — `building_classrooms.door_id` already enforces one room per door.
