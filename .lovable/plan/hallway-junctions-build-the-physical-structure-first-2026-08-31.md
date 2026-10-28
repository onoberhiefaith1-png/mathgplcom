# Hallway Junctions — Build the Physical Structure First

Focus of this plan: the hallway itself and the cut in the wall. Navigation is only the thin layer on top of it (see → click → enter → click back). No cinematic turning, no rotating map.

## 1. A hallway is a road; a branch is a real opening in its wall

- A hallway is a straight road. Doors are destinations along it. A branch hallway is another road connected to it through a genuine opening cut in the wall — never a second corridor parked alongside.
- The branch leaves at approximately **60°**, so from one standing position you see the hallway you are in *and* the connected hallway through the opening at the same time, exactly as in the reference render.
- Branches can branch forever. A branch never reconnects to another branch. Every hallway stores its parent, so Back is always known.

## 2. No Left/Right choice when adding a hallway

- The editor shows only **+ Add Hallway** and **+ Add Door** for the hallway you are currently inside.
- The system assigns the side automatically by the alternating sequence along that road: **first right, then left, then right, then left**. Doors sit in the same alternating sequence, so a hallway opening and a door can never end up opposite each other.
- The road's length keeps growing automatically as doors and junctions are added. There is no length control and no "Extend".
- Entering a hallway makes it the current workspace: whatever you add belongs to it. The panel header reads the current hallway's name.

## 3. The wall cut (the part that must look right)

Built as real architecture, matching the reference proportions:

- The wall genuinely **stops**: two wall runs with a gap, not a hole punched in a flat plane.
- **Wall thickness is visible** — the reveal/jamb returns show the wall's depth at both edges of the gap, splayed to follow the 60° corridor.
- **Ceiling continuity**: a soffit beam spans over the opening, continuing the ceiling line into the branch; the branch's own ceiling and recessed panel lights are visible receding away.
- **Floor continuity**: one continuous floor runs from the current hallway through the opening into the branch, no seam or lip.
- The branch corridor's walls, floor, ceiling, panel lights and floor-level spots are **rendered while you stand in the parent hallway** — that is what makes the second corridor genuinely visible instead of a dark void. Depth beyond the branch's first stretch is culled to protect performance.
- Lighting reads like the render: dark grey walls, warm recessed ceiling panels, small floor-level wash lights, pale continuous floor.
- Wall signage in the reference's style names the branch with an arrow. A cut-through never resembles a door; doors stay recessed leaves.

## 4. Navigation on top of it

- Standing anywhere near the junction, the opening is a clickable target. Click it and your **current location becomes that hallway**, facing down it. Position and heading change; the building and the map do not rotate.
- Inside the branch, the mouth you came through sits on the opposite side, labelled with the parent hallway's name. Click it to return. You can bounce between the two hallways indefinitely.
- The map stays fixed with the entrance at the bottom reading upward; only your position marker moves, and the new branch appears on it the moment it is created.

## Technical notes

- `src/lib/building/types.ts` / `src/lib/building/api.ts`: `direction` stops being a user choice. `addWalkway` derives the side from the count of existing branches on the parent (odd → right, even → left) and keeps writing `left`/`right` so existing data and the map stay valid. `junction_at` is still written, derived from the object sequence rather than a slider.
- `src/lib/building/navigation.ts`: add a `BRANCH_ANGLE` (60°) and rotate a branch heading by that angle instead of 90°; `turnHeading` gains an angle parameter with the existing 90° behaviour kept for tests that assert it. Add a helper returning the splayed opening footprint (gap width, jamb depth, splay angle) so the 3D cut and the map junction come from one source.
- `src/components/academy/world/HallwayScene.tsx`:
  - Rebuild the wall runs so each hallway wall is generated as segments broken by its openings, instead of one continuous plane.
  - Rebuild `BranchOpening` as splayed reveal panels + angled soffit + continuous floor, sized from the shared helper.
  - Render each child segment's corridor shell (walls, floor, ceiling, lights; no doors) when its junction is on the hallway you occupy.
  - Entering/leaving a branch becomes a location switch (segment + heading + short position ease), not a turn animation.
- `src/components/academy/editor/WalkwayManager.tsx` / `AcademyEditorPage.tsx`: remove the direction radio and junction slider; **Add Hallway** takes only a name and attaches to the current hallway. Header shows the current hallway as the workspace.
- `src/lib/__tests__/buildingNavigation.test.ts`: cover the alternating side assignment, the 60° heading, and the opening footprint helper.
- No schema change needed.

## Verification

- Unit tests + typecheck.
- Browser pass: add two hallways and several doors, confirm sides alternate automatically, confirm from the main hallway you can see down the main hallway and into the branch through a realistic cut, click in, see the parent mouth on the opposite side, click back, and confirm the map gains the branch without rotating.
