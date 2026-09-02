# Show the entrance door inside the room

Right now, when you are inside a room and turn around, the way out is just an open dark rectangle in the back wall. It should show the very same door you walked through — same style, same size, same position — seen from the inside.

## What changes

- The back wall's doorway stops being an empty hole. The door panel that belongs to that room's door is rendered in the opening, facing into the room.
- It uses the exact door style/design stored on that door (same artwork, transparency, frame accent, brightness) as the corridor side, so both faces match.
- The door keeps the frame/panel separation already used in the corridor: the frame keeps its accent material, the panel shows the imported artwork untinted.
- Clicking that inside door leaves the room, the same as the existing "Leave through the door" control (which stays).
- Local light at the doorway so the door reads clearly instead of sitting in shadow.

## Not touched

Room shape and tiers, smart screen, nameplate, walls/floor/ceiling designs, lighting elsewhere, hallway geometry, doors in the corridor, building map, editor panels.

## Technical notes

- `ClassroomShell.tsx` gains an optional `doorDesign` prop (the `DoorDesign` of the owning door). It renders a door group at local `z ≈ 0`, rotated to face `+z` (into the room), sized to `openingWidth` × 3.1 to match the existing opening and lintel.
- Panel + frame meshes reuse the same texture/alphaMap loading path as `DoorMesh` in `HallwayScene.tsx`; the shared piece is extracted into a small component so both sides stay identical rather than duplicating material logic.
- `HallwayScene.tsx` passes the door record's `design` (already fetched with the door) plus an `onLeave` callback bound to the existing exit action.
