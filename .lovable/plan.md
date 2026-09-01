# Junction finishing pass — make merges look built

Focus: the place where one hallway runs into another and forms a new junction. Verified from the code, the merge path currently trims the arriving hallway and cuts a mouth in the hallway it meets, but nothing reserves clear space at that end, nothing pulls the arriving shell back from the wall it meets, and labels can be left on a wall run that was cut away. That matches the reported symptoms: a wall sticking out, a door sitting across the road, edge flicker, and a hallway name reading in mid-air.

## Step 1 — Walk it first

Sign in, walk the existing building (Entrance Hall → yu → mn → reu → gf → ki loop from the screenshots), and capture the junction from four angles: approaching, standing in the throat, looking back, and from inside the hallway that was merged into. Each defect below is confirmed against a captured frame before and after the fix, so the fix is measured against what you actually see, not against the theory.

## Step 2 — The merge end becomes a real junction mouth

- Reserve a junction clearance at the merged end of the arriving hallway (half a corridor width plus a margin). No door, no branch, no plaque may sit inside it.
- Pull the arriving hallway's side walls, floor slab and ceiling slab back to the face of the wall they meet, instead of overrunning it. The floor and ceiling continue through the throat as one surface owned by the hallway that was merged into, so there is no double slab and no black seam.
- Widen the cut in the hallway that was met to the full corridor width plus jambs, with a lintel/soffit over it, so the opening reads as a doorway-sized architectural crossing rather than a hole in a plane.
- Cap nothing at a merged end (no terminal wall), but close the two short returns beside the opening so you never see the outside face or the inside edge of a wall.

## Step 3 — Doors never land in the road

- Object fitting at a shortened hallway keeps a hard minimum spacing and respects the junction clearance.
- When compression alone cannot fit everything, alternate sides so both walls are used before spacing is reduced further; the run is only ever packed onto wall surface, never into the throat.
- If capacity is genuinely exhausted, the hallway keeps its objects at correct spacing and the excess is placed on the continuation past the junction rather than stacked in the crossing.
- Adding doors continues to grow a hallway until it meets another one, and that meeting still becomes a junction — that behaviour stays.

## Step 4 — Wall edges stop glitching

- Give every wall run, jamb, lintel and slab a single owner: adjacent pieces butt at shared coordinates rather than overlapping, and any unavoidable co-planar pair gets a small structural offset plus polygon-offset so it cannot fight for depth.
- Close the vertical edge of every cut wall run with a real reveal (jamb block of full wall thickness), so a wall never shows as an infinitely thin sheet from an angle.
- Remove the leftover deck overrun past a merged end, which is the piece currently bleeding into the other hallway's floor.

## Step 5 — All writing lives on a wall

- Every plaque is anchored to a wall run that actually exists after the cuts. A plaque whose host run was removed by a junction moves to the nearest solid run on the same wall.
- A merged hallway's name goes on the jamb/return beside its mouth, and on the facing wall of the hallway it merged into, so you read the name as you approach the junction.
- No label is positioned by corridor centre, ceiling, or free space — a plaque with no host wall is not drawn at all.

## Step 6 — Verify

- Walk the same four junction viewpoints again plus the two new merges, checking for flicker, protruding walls, doors in the road, floating text, and black gaps.
- Unit tests for junction clearance, object fitting under clearance, alternating-side packing, and plaque host-run resolution.
- Typecheck and the existing building navigation suite must stay green.

## Technical notes

- `src/lib/building/navigation.ts`: add `JUNCTION_CLEAR`, make `fitObjectsToLength` clearance-aware with side alternation, and expose the merged-end trim so both the solver and the renderer use one number.
- `src/components/academy/world/HallwayScene.tsx`: `mergeRoadInto` records an end trim; `SegmentCorridor` gains an `endTrim` and stops the wall/deck spans there (replacing the `frontPad` 0.4 overrun in `decks`); the mouth builder gets jamb reveals plus soffit; `Nameplate`/`HallwayNameFrame` placement resolves against the surviving wall runs.
- No changes to materials, textures, gallery assets, lighting design, door artwork, camera behaviour, or the Building Map.
