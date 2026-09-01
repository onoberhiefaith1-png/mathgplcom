# Close the auditorium step openings — build them as real stairs

The circled bands in the screenshot are the gaps between the auditorium's stepped floor levels. Today each level drop is closed by a single one-sided vertical sheet, so:

- from inside the room the drop faces away from the ceiling lights and reads as a flat black band
- from a lower level looking back it is invisible (one-sided), leaving an open slot under the tier above

## What changes

1. **Each floor level becomes a solid step, not a sheet.** The drop between levels is built as closed geometry (a stepped block with a top tread and a full-height riser plus side caps), so there is no direction from which you can see through the step and no open gap under the level above.
2. **Stairs, not one big drop.** Each 0.55 m level change is subdivided into 2 shallow stair steps (tread + riser) spanning the full room width, so the transition reads as an architectural staircase like the reference expectation, with a slim nosing line at each step edge.
3. **The steps blend with the room.** Treads and risers use the same floor surface/material and texture the level slabs already use — no new colours or materials — with the riser mapped so the pattern continues rather than stretching.
4. **The steps are lit.** A low, wide step wash is added along each level edge so risers are visible instead of black, matching the existing room ceiling lighting look (no change to lighting style elsewhere).
5. **Walking stays correct.** The room walker's height lookup keeps using the same level table, so eye height still follows the floor as you walk down; each stair sub-step is visual only within its level's run.

## Out of scope

No changes to room size or level count, walls, ceiling, doorway, plaques, hallways, building map, camera, editor, galleries, or materials/textures selection.

## Technical notes

- `src/components/academy/world/ClassroomShell.tsx`: replace the riser `Surface` plane in the tier map with a `StepRun` sub-component that emits N sub-steps as closed boxes between `t.y` and `tiers[i+1].y` at `t.to`, plus edge nosings and side caps against the left/right walls.
- Reuse `surfaceProps(env, "floor", textures)` for tread/riser so individual room settings still drive them; keep `THREE.FrontSide` only where a face is guaranteed inward, otherwise use closed box geometry.
- Add small `pointLight`/rect-style wash entries to the existing room lighting block, positioned above each level edge.
- Verify with an authenticated Playwright pass into the auditorium at 1280x1800, screenshotting from the entrance and from the front area looking back up the steps.
