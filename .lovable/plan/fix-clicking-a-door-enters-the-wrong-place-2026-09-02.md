# Fix: clicking a door enters the wrong place

Clicking the circled door zooms and enters a room, but not the room that belongs to that door position — the camera lands somewhere else in the building.

## What the data says

The database is clean: every room row is attached to exactly one door, one room per door, and the room name matches the door's label. So this is not a data or mapping problem — it is a position problem in the 3D scene.

## Likely cause

Doors are drawn inside the corridor's own local group (offset only by their distance along the hallway), but the click handler computes the door's world position separately from the hallway's stored start point and heading. Since junction merging trims and re-anchors corridors, those two ways of locating the same door can disagree — so the zoom target and the room shell are mounted at a different spot than the door you actually clicked, and you appear to enter the wrong place.

## Plan

1. Verify live: sign in, walk to the circled door, click it, and record the clicked door's id, the room id/name that opens, the door's drawn world position and the position the room is mounted at. This confirms whether the two disagree and by how much.
2. Make one source of truth for a door's world position: derive it from the same transform that renders the door mesh (its parent corridor group), instead of recomputing it from raw hallway start/heading. Use that single value for the zoom target, the facing direction, and the room mount.
3. Apply the same treatment to trimmed/connector corridors so a door near a junction resolves to the same point as its mesh.
4. Re-verify in the browser: click several doors on different hallways (including one next to a junction and one on a connector) and confirm each opens the room named on its plaque, entered from behind that exact door, and that leaving returns to the same corridor spot.

## Out of scope

No changes to door styling, plaques, room shells, smart screen, hallway layout, Building Map, materials, lighting, or the editor. Geometry/identity resolution only.

## Technical notes

- `HallwayScene.tsx` `renderObjects`: `wx`/`wz` are computed from `seg.start + seg.heading * o.along + side offset`, while `DoorMesh` is rendered inside `<group position={[0, 0, -o.along]}>` within the segment's transform. These must be reconciled.
- `startDoorZoom(world, front, …)` and `enterClassroom(doorWorld, into, room)` both consume that world value, so a single corrected helper fixes zoom, entry, and exit together.
- Room identity itself (`classroomsByDoor.get(d.id)`) stays as is; it is already correct.
