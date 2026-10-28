# Fix the hallway junction geometry (60° architectural intersection)

Goal: rebuild the branch junction as two real corridor volumes joined at ~60°, with true wall thickness around the opening, continuous floor and ceiling through the intersection, and both corridors visible at eye level from one standing position — before entering.

## What is wrong today (confirmed in the code)

- Corridor walls are single-sided planes (`planeGeometry`), so every edge is paper-thin. The only thickness is two small jamb boxes at the mouth.
- A branch corridor starts exactly on the parent's centre line, so the branch's own shell runs backwards through the parent corridor and its side wall sits across the mouth — that wall is what blocks the view into the branch.
- The opening width is measured straight along the parent wall (`4.5`), but a corridor leaving at 60° needs a longer footprint along that wall; the gap is too narrow to see down the branch.
- The reveal is splayed by a flat 30° inside a wall-facing group, so the jambs do not line up with the branch's actual heading; the two sides of a 60° junction are not symmetric and must be computed separately.
- There is no intersection ("throat") volume where the two corridors overlap, so floor, ceiling and walls do not meet.

## The fix

### 1. Junction geometry maths (`src/lib/building/navigation.ts`)
- Replace `openingFootprint` with a junction solver that takes hall width, wall thickness and the 60° branch angle and returns: mouth footprint measured along the parent wall (`width / sin(60°)`), the two jamb positions and angles (acute side and obtuse side differ), soffit height, and the branch's start offset — pushed forward along the branch heading so the branch shell begins at the mouth, never inside the parent corridor.
- Add a shared `WALL_THICKNESS` constant (~0.24 m conceptual blockwork) used by walls, jambs and the map.
- Keep `wallRuns`, but feed it the widened mouth footprint so the parent wall genuinely stops on both sides of the diagonal mouth.
- Extend the unit tests in `src/lib/__tests__/buildingNavigation.test.ts`: mouth footprint widens with angle, jamb angles are the acute/obtuse complements, branch start clears the parent corridor, wall runs never overlap the mouth.

### 2. Real wall thickness (`SegmentCorridor` in `HallwayScene.tsx`)
- Build each wall run as a thin box (`boxGeometry`, depth = wall thickness) instead of a plane, with the textured `Surface` on the corridor-facing face and a plain material on the sides/back, so every cut edge shows depth, catches light and casts shadow.
- Offset the wall boxes outward by half the thickness so the interior corridor width stays exactly `HALL_WIDTH`.
- Trim the branch corridor's shell at its mouth (start offset from the solver) so it can never cover the opening; keep floor and ceiling running through.

### 3. The junction itself (`BranchOpening` → `HallwayJunction`)
Rebuild it as one continuous intersection piece rather than a hole plus decoration:
- Solid jamb blocks on both edges of the mouth, each rotated to its own computed angle, extruded through the full wall thickness so the front face, inside jamb and the return into the branch are all visible from an angle.
- A soffit beam over the mouth at the correct diagonal, meeting the branch ceiling.
- A floor and ceiling infill polygon covering the throat where the two corridors overlap (built from the four junction corner points), so there is no seam or gap underfoot.
- Wall returns that continue from each jamb into the branch's near wall — the intersection reads as walls meeting, not panels floating.
- A small local light plus contact shadow at the throat so the thickness is legible.
- The click target stays the mouth polygon; hover highlight and hallway sign behaviour unchanged.

### 4. Visibility before entering
- Render the connected branch corridor's full shell whenever the user is in the parent (already the case for neighbours) and remove the neighbour-side wall run that currently hides it.
- Verify from eye level: standing in the main corridor before the junction, the frame shows the main corridor ahead and the branch receding at 60°, including its floor, walls, ceiling and doors.

### 5. Navigation and map (kept as-is, only aligned)
- Clicking the visible mouth enters the branch; the mouth behind you returns to the parent — the existing bidirectional link and step-by-step junction stops stay unchanged.
- Automatic side alternation and no Left/Right/Extend prompts stay as they are.
- Update the mini-map junction stub to the same solver output so plan and 3D agree.

## Verification
- Unit tests for the junction solver and wall runs.
- Playwright eye-level captures in the academy editor: approaching the junction, standing at it, inside the branch looking back — checked for a visible thick jamb, both corridors in view, and no wall across the mouth.
- TypeScript check and route smoke check.

## Out of scope
No changes to hallway/door creation flows, permissions, data model, or the surface/texture editor.
