# Frames: clickable shortcut boards on building walls

A Frame becomes a real building object, alongside Door and Lock. The teacher hangs one of the three uploaded frame artworks on a wall, positions and names it, then links existing learning items to it. Students see it on the wall, click it, and reach the teacher's content — nothing is copied.

## The three designs

The three uploaded artworks (Assignment, Adventure, Courses) are registered as CDN assets and become the only selectable frame designs. They are used exactly as supplied — no new artwork, no restyling.

## Add Frame flow

Inside Building Editor, next to Add Room / Lock settings:

1. Add Frame
2. Choose a design (the three artworks, shown as pickable thumbnails)
3. Choose location — a hallway, or one of the existing rooms (Classroom, Teaching Hall, Auditorium)
4. Choose the wall — Left, Right, or End wall (only the walls that actually exist in that place)
5. Position mode: live in the 3D view, nudge left/right and up/down, make bigger/smaller; the frame stays flat against the wall at all times
6. Name it (e.g. "Algebra Practice")
7. Link content, then Save

Everything saved — design, place, wall, offsets, size, name, links — survives refresh and returning later.

## Linking content

"Link Content" opens the existing content picker grouped into Courses, Assignments/Exercises, Adventures and Games, listing only items the account already owns or can see. One frame holds many items; the same item cannot be added twice. Removing a link removes only the shortcut. Deleting a frame never deletes any learning item.

## What the student sees

The frame hangs on the wall where the teacher put it and is clickable up close.

- One linked item: clicking opens that item in its existing experience.
- Several: clicking opens a clean frame panel listing the linked items by name and type; picking one opens its existing experience.

Back from an item returns to the frame panel; back from the panel returns the student to the exact spot in the room or hallway they came from — never the dashboard.

## Editing later

Selecting an existing frame in edit mode gives: move, resize, rename, change design, add/remove linked content, delete frame.

## Technical notes

- New tables (with GRANTs + RLS mirroring `building_room_locks`/`building_room_screens`):
  - `building_frames` — `building_id`, nullable `walkway_id` and `classroom_id` (exactly one set), `wall` (`leftWall`/`rightWall`/`endWall`), `design` key, `offset_along`, `offset_y`, `width`, `name`, timestamps. Edit policy via `can_edit_building`, read via `can_view_building`.
  - `building_frame_links` — `frame_id`, `content_kind` (`course`/`assessment`/`adventure`/`game`), `content_id`, `position`, unique `(frame_id, content_kind, content_id)`.
- `src/lib/building/frames.ts`: types, design registry (three `.asset.json` pointers), wall-mount geometry helpers (reusing `classroomDimensions` and hallway wall maths, the same way `screen.ts` does), and CRUD. Frames load with `BuildingData` in `api.ts` and are added to `BuildingData`.
- Content picker reuses `loadProductCatalogue()` / `productRoute()` from `src/lib/academy/api.ts`; opening an item navigates to its existing route, so no learning UI is rebuilt. Note: the catalogue currently exposes Courses, Assessments (assignment/exercise cards), Adventures and Games — those are the linkable kinds.
- Rendering: new `FrameBoard.tsx` in `src/components/academy/world/`, mounted from `ClassroomShell` (room walls) and `HallwayScene` (hallway walls) using the same pick-plane/facing rules as doors so navigation controls cannot raycast into it.
- Editor: `FrameManager.tsx` in `src/components/academy/editor/` for the wizard, position controls and link list, surfaced from `BuildingSettingsPanel` after Doors/Lock.
- Building context for Back is carried through router state, so returning lands on the same walkway/room and camera spot.
- Untouched: hallway/junction geometry, door and lock behaviour, smart screen, Building Map, camera, materials, lighting.
