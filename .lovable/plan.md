# Building: entrance door, zoomable map, persistent controls

Three isolated changes, done in order 1 → 2 → 3, each testable on its own. No rebuild of the navigation system.

## 1. Entrance door at the start of the main hallway

- The main hallway currently starts at an open boundary: walking backward out of it drops the walker straight back to the Building view with no visible door.
- Add a single Entrance Door rendered at the start of the root hallway, on the wall plane facing down the hallway, using the same door asset/style the building already uses (the building's door design, same reveal/jamb treatment as every other door).
- It is a **rendered fixture derived from the root hallway**, not a database row — so editing the building can never create a duplicate entrance, and no migration is needed.
- Turning around and walking back down the main hallway ends at this door instead of a blank wall.
- Clicking the door exits the building and returns to the Building/World view — the same destination as the existing top "Building" button, which keeps working unchanged.
- Walking backward past the entrance keeps its current fallback behaviour (returns to the Building view), so nobody can get stuck.
- Nothing else about hallways, doors, branching or junctions changes.

## 2. One fixed map container with zoom in / out

- Remove the Small / Medium / Large selector entirely.
- The map container keeps one fixed size, matching today's Medium.
- Add `+` and `−` controls inside the map. Zoom changes only how many metres of building fit inside the fixed frame:
  - `−` shows more of the maze, less detail.
  - `+` focuses tightly on the walker's surroundings.
- The map stays a GPS-style follow view: the drawing slides under the fixed window so the player marker always stays in view, at any zoom level, however large the building grows. The map never rescales itself to fit the whole building.
- Branches, loops, connector corridors, doors, endpoints and the walked-route highlight all continue to draw, just at the chosen zoom.

## 3. Forward + Turn around always available

- Today the control bar is gated on the walk phase, so it only appears once the walker has entered a hallway or door — that gate is the bug.
- Make the two controls render from the moment the world view opens and stay until the user leaves the building: they never disappear at a door, at a hallway end, or at a junction.
- Right button remains "hold to Move forward"; holding it from the initial state simply starts walking down the main hallway. Release stops. No auto-movement.
- Left button remains "Turn around" (180° pivot in place, then stationary until forward is held). When a connected junction is close enough ahead it still becomes "Enter <hallway>" — but the pair of controls is always on screen.
- Junction re-entry (A → B → turn around → back into A) keeps working exactly as it does now.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx`
  - Entrance door: new fixture rendered at the root segment's origin using the existing door asset component and `env.door` design; click handler calls a new optional `onExitBuilding` prop (falling back to the existing browse/exit path).
  - Map: delete `MAP_SIZES` / `MapSize` / the `size` state and its buttons; keep the container box fixed and multiply `MAP_METRE` by a clamped zoom factor (roughly 0.4x–3x, exponential steps) with `+`/`−` buttons; follow logic unchanged.
  - Controls: replace the `canBack` gate on `WalkControls` with always-on rendering (suppressed only during the door zoom transition), and have the forward hold enter walk mode when the scene is still in `browse`.
- `src/pages/academy/AcademyWorldPage.tsx`: pass the existing Building-button exit handler to `HallwayScene` as `onExitBuilding`.
- No database or API changes in any of the three steps.
- Verification per step: typecheck, existing building/navigation tests, and a Playwright pass on `/academy` and `/academy/edit` (controls present on load, entrance door visible after turning around, zoom buttons changing map coverage).
