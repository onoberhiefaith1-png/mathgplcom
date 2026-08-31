# Hallway Structure — Rebuild the Model, Then the View

The building becomes one structure with three views: the 3D corridor, the Building Map, and the navigation graph. Nothing is drawn by hand; everything is derived.

## 1. The structural model (source of truth)

- A **hallway is a road**. Its physical length is derived from what sits on it (doors + junctions), so it grows automatically. There is no "extend" anywhere in the model or UI.
- **Add Hallway** = a new road connected at a junction on the selected road, on the **Left** or **Right** only.
- **Add Door** = a destination placed along the selected road.
- Three distinct things at any point on a road: **Door**, **Hallway Junction**, **Terminal Wall** (the physical end when nothing continues).
- Branches may branch again, without limit, so the building becomes a connected maze.

Junctions stay **perpendicular in the data and on the map** (clean network geometry, as you confirmed). The 60° look is achieved in the geometry of the opening, not by rotating the road.

## 2. The junction you see (the reference image)

At a junction the parent wall genuinely stops and a wide cut-through opens:

- The cut is widened and its jambs/soffit are **splayed at 60°**, so standing anywhere near the junction you see straight down the parent hallway **and** into the branch hallway at the same time — two hallways visible in one view, exactly like the reference.
- The floor runs continuously through the cut; the ceiling continues as a soffit over it; the branch corridor's own walls, floor, ceiling and lighting are visible receding into the distance.
- The branch hallway is **rendered while you are in the parent** (currently only the hallway you occupy is drawn) — that is what makes the second corridor visible instead of a dark hole.
- A wall sign in the reference's style names the branch with an arrow.
- A cut-through never looks like a door. Doors stay recessed leaves with plates; junctions are openings in the wall.

## 3. Movement — step-by-step only

The continuous "play"/auto-walk is removed:

- No pause/resume play button, no automatic forward travel.
- Each press of Forward (button, ArrowUp, W) advances **one step** to the next point of interest — the next door bay, the next junction, or the terminal wall — with the existing smooth easing.
- At a junction, Left / Right / Forward appear as choices; the camera turns smoothly into the chosen hallway.
- Back retraces one step, and out of a branch through the mouth you entered.
- First-person throughout, no visible character.

## 4. Map and settings stay bound to the same structure

- The map is generated from the same compiled graph: hallway = segment, junction = node, door = endpoint. Adding a hallway or a door updates it immediately, with the entrance at the bottom reading upward.
- Adding a hallway refreshes the 3D world in the same action, so the new opening, corridor, walls, floor, ceiling, lighting and pathway all appear at once.
- The five surfaces remain **Left Wall, Right Wall, Floor, Ceiling, Terminal Wall**, each verified to drive the visible surface it names.

## Technical notes

- `src/lib/building/navigation.ts` — keeps `compileNavGraph`, `lengthForObjects`, `junctionDistance`, `turnHeading` unchanged (perpendicular). Add a `JUNCTION_SPLAY` constant plus a helper returning the splayed reveal footprint so the 3D cut and the map's junction marker come from one place.
- `src/components/academy/world/HallwayScene.tsx`
  - `BranchOpening`: widen the cut, replace square jambs with 60°-splayed reveal panels + angled soffit, and keep the continuous floor and pick target.
  - Render the child segment's corridor shell (walls/floor/ceiling/lights, no doors) when its junction is on the hallway you occupy, so you see into it. Cull anything deeper to protect the draw-call budget.
  - `Machine`/`CameraRig`: replace continuous `speed`/`moving` travel with discrete `stepTo(target)` hops between derived stop distances; keep the exponential easing and the turn/zoom phases.
  - `NavControls`: drop the play/pause control; Forward becomes a step, junction choices unchanged.
  - MiniMap: unchanged orientation; junction nodes drawn from the shared helper.
- `src/lib/__tests__/buildingNavigation.test.ts` — add coverage for the splay helper and for stop-distance ordering (door bays, junctions, terminal wall).
- No schema change: `junction_at`, `direction`, `parent_id` already express the model.

## Verification

- Unit tests for graph, layout, splay and step targets.
- Typecheck.
- Browser pass in the Academy editor: create a hallway, confirm the branch appears in the 3D view and on the map in the same moment, walk step-by-step to the junction, confirm both hallways are visible, turn in, and change each of the five surfaces to confirm the correct surface changes.
