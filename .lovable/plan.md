# Doors must always open their own room — permanently

## What is wrong

Clicking a door should walk you into the room behind that exact door. Instead you end up back in the Academy. Two things in the current code make that possible, and one is unconfirmed:

- Verified: every door in the database does have exactly one room (42 doors, 42 rooms, none missing), so this is not missing data.
- Verified: only the thin door *panel* is clickable. The frame, jambs, threshold and nameplate are not, so a click a few centimetres off the leaf passes through to whatever is behind it (corridor pick targets, the entrance door that leaves the building) — which reads as "it opened the Academy instead of my room".
- Verified: `AcademyWorldPage` still hands the 3D scene two legacy handlers (`onEnterRoom`, which navigates to `/academy/room/:id`, and `onOpenDoor`, which navigates to a product route). They are currently unused, but they are exactly the "open the Academy page" behaviour, and they are one accidental wiring away from returning.
- Unconfirmed: a runtime `ReferenceError` is being reported in the preview. If it fires while the room shell mounts, the room never appears and you are left in the corridor. Step 1 below confirms or clears this before anything else.

## The fix

1. **Confirm the crash first.** Reproduce a door click in the running app with the console open, capture the real stack for the reported `ReferenceError`, and fix its root cause (most likely a room surface setting, e.g. Start Point, that is missing from an older saved configuration and is read without a fallback).

2. **One forced resolver, used everywhere.** Add a single function that, given a door, returns the room that belongs to it — matched strictly on the door's own id. Every place that opens a door goes through it. No other lookup path is allowed. If the room is not in the loaded building data, the resolver re-reads that one door's room from the database and uses the result, so a stale page can never mean "no room".

3. **Doors can never navigate.** Door entry stays camera movement inside the same scene. Remove the legacy `onEnterRoom` / `onOpenDoor` wiring from the Academy page so no door click can ever reach `/academy/room/...` or a product route again.

4. **The whole doorway is the door.** Make the frame, jambs, threshold, nameplate and a full-opening pick surface all enter the same room, and stop the click there so it can never fall through to a corridor mouth or the exit door.

5. **Fail loudly, never silently.** If a door still cannot resolve its room, the door shows its "room missing" state and clicking it explains that in a message naming the door — it never does nothing and never falls back to another view.

6. **Regression guards so it cannot come back.** Add tests that: every door resolves to exactly one room; the room handed to the entry function is always the one whose `door_id` equals the clicked door; and the Academy page passes no navigation handler for doors.

## Not touched

Hallways, junctions, door positions and styles, room shapes, Smart Screen, navigation controls, lighting, materials, Building Map.

## Technical notes

- Resolver lives beside the room helpers in `src/lib/building/classroom.ts`; `HallwayScene.tsx` replaces its local `classroomsByDoor` read with it and keeps the map only as a render cache.
- Door click path stays `DoorMesh.onEnter` → `startDoorZoom` → `enterClassroom(door, into, room, visual)`; only the room argument's provenance changes.
- Pick surface is an invisible plane covering the full opening inside the door group, so it inherits the door's transform and cannot drift from the leaf.
- Tests go in the existing vitest suite next to the navigation tests.
