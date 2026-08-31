# Hallway Architecture, Straight-Walk Navigation & Fixed Minimap

Rebuild only the hallway *structure and navigation* inside the existing 3D building. The rotating building, course pages, course management, building editor, surface/upload system and permissions stay exactly as they are.

## What changes for the user

**Entering** — Clicking into the building always lands you in a named **Main Hallway**: a finite corridor with left wall, right wall, floor, ceiling and a solid **end wall**. No void, no exposed sky, no dark space beyond the corridor. Walking backwards past the entrance returns you to the rotating building.

**Walking** — Only Forward and Backward. You always face straight down the corridor; the zigzag left/right camera swinging in browse mode is removed. Keyboard (W/S, ↑/↓), on-screen buttons and vertical swipe all do the same thing.

**Objects on the hallway** — Only two kinds: a **Door** (closed, on a wall, opens the existing course page) and a **Sub-Hallway opening** (roughly double door width, an actual opening in the wall, no door leaf). Both have editable names. Objects **alternate sides** and are never directly opposite each other — the layout engine enforces this: no Door↔Door, no Hallway↔Hallway, and no two objects sharing the same distance along the corridor.

**Entering a sub-hallway** — Selecting a sub-hallway opening does *not* spin the camera 90°. The camera glides through the opening while the new corridor is presented as straight ahead; the corridor you came from becomes an opening behind/beside you (its objects now sit on the opposite wall). Backward from a sub-hallway returns to the parent hallway, then the entrance, then the rotating building — never an empty environment.

**Minimap** — A small fixed HUD panel in the **top-right**, always visible while navigating. It draws the *true* top-down layout: main hallway, 90° branches, doors as small markers, hallway names as small labels, building entrance at the bottom, and a live player marker with a direction arrow. The map never rotates; only the marker moves and turns. It is generated from the same building layout data the 3D navigation uses, so adding/renaming/deleting a hallway or door updates it automatically (realtime subscription already in place).

**Naming & assignment** — In the building editor, every hallway and door has a name field ("Algebra Hallway", "Quadratic Equations"). From the course library a **Send to Building** action asks: Building → Hallway → Door, and assigns that course to the chosen door.

## Technical approach

**Data (migration)**
- `building_walkways`: add `name TEXT NOT NULL DEFAULT 'Hallway'`. First root walkway is named `Main Hallway`.
- `building_doors`: reuse existing `title_override` as the door name (already there); no new column.
- No change to grants/RLS beyond what exists (policies are table-wide `FOR ALL`).

**Layout engine (single source of truth)** — extend `src/lib/building/navigation.ts`:
- `compileNavGraph` keeps producing world geometry (unchanged coordinate maths, existing tests keep passing).
- New pure function `layoutHallwayObjects(segment, doors, childWalkways)` returns an ordered list of `{ kind: 'door' | 'opening', id, name, side: -1|1, along }` that: sorts by stored order, assigns alternating sides, and spaces entries by a minimum gap so nothing is opposite or overlapping. Unit-tested for alternation, no-opposite and gap rules.
- The 3D scene and the minimap both consume this function — no second layout implementation.

**Scene (`HallwayScene.tsx`)**
- Remove the browse-mode zigzag camera; `browse` becomes a straight entrance view looking down the corridor. Movement phases reduce to walking forward/backward plus door zoom and a branch *transition* (glide through opening, then re-base the camera onto the child segment already facing forward — no visible 90° sweep).
- Add an **end wall** mesh at each segment's terminus using the same surface settings as the walls, and cap segment openings so no gap exposes the background; scene background/fog stays inside corridor tone.
- Doors render as closed door leaves + frame + name sign on the wall at their computed side/`along`. Sub-hallway openings render as a wall aperture ~2× door width with a name lintel, no leaf.
- Backward past the entrance calls an `onExit` callback (existing) to return to the rotating building.

**Minimap** — replace the current bottom-right toggle panel with a fixed top-right HUD (`absolute top-3 right-3`, compact, rounded, bordered, translucent, responsive, non-interactive to navigation). Draws true branch geometry from the nav graph, door markers with name tooltips, small hallway labels, entrance marker, and an arrow marker driven by the live nav machine each frame. No rotation of the map itself.

**Editor** — `WalkwayManager` gains an inline name field per walkway and per door, and the Add-hallway action keeps Left/Right choice (already present). Course library (`CourseBuilderLibrary`) gains **Send to Building**: a dialog listing buildings → hallways (by name) → doors (by name), writing `content_kind: 'course'`, `content_id` via existing `updateDoor`.

**Door target** — a door with a course opens the existing `/academy/course/$courseId` page; other product kinds keep using the existing `productRoute` mapping. No new room/course system.

## Verification
- Vitest: navigation graph tests plus new alternation/no-opposite/spacing tests.
- `tsgo --noEmit`.
- Authenticated Playwright run: enter building → screenshot shows enclosed corridor with end wall (no void) → walk forward/backward → enter a sub-hallway and confirm the camera does not rotate 90° and the corridor stays enclosed → confirm top-right minimap shows the 90° branch and the marker/arrow moved → back out repeatedly to the rotating building → add a door in the editor and confirm the map and corridor update without reload.

## Out of scope (as instructed)
Decorative room interiors, hallway visual polish/materials/lighting effects, new course or assessment engines, and any change to the rotating building, course pages or upload system.
