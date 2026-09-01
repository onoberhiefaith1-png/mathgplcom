# Hallways always meet, merge and make a junction

Remove the "this hallway ends at its junction… it cannot grow any further" refusal and replace it with automatic clamping: a hallway that runs out of space simply shortens its final run, snaps flush to the hallway it meets, and creates a real junction there. It still never continues past that junction.

## Behaviour

- Adding a door or a branch to a hallway that has merged into another hallway is always allowed. No toast, no thrown error, no "This hallway is full".
- The arriving hallway's length is clamped to the exact connection point. The final run adapts to whatever distance is available — 2 units, 1 unit, 0.1, 0.01 — and ends flush against the target hallway's near wall.
- Because the run can be shorter than the doors on it would normally need, the objects on a merged hallway are packed into the available run (spacing compressed down to a floor) instead of being dropped. Nothing a teacher adds silently disappears.
- The junction itself is unchanged in appearance: mouth cut into the target wall, no end cap on the arriving road, continuous floor and ceiling through the opening, two-way navigation.
- Passing through and continuing beyond a junction remains impossible: the road stops at the junction, and growth is expressed as compression plus a new branch from that junction, never as tunnelling.
- Existing automatic branch placement (next free slot, ~60° where applicable) stays exactly as it is.

## Technical scope

1. `src/pages/academy/AcademyEditorPage.tsx`
   - Delete `mergeBlock` and its two call sites in `handleAddWalkway` and `handleAddDoor`, along with the now-unused `mergeLimits` import. Creation proceeds unconditionally; geometry decides the outcome.

2. `src/lib/building/navigation.ts`
   - Lower the merge minimum (`MIN_MERGE_RUN`) to a small epsilon so a very short remaining gap still produces a flush snap rather than being padded out to a fixed minimum.
   - Add a layout mode that fits `n` objects into a given available length: keep standard `OBJECT_SPACING` when it fits, otherwise distribute objects evenly across the run down to a minimum spacing, preserving the entry run and mouth clearance.
   - Keep `mergeLimits` exported (it is still the source of truth for the trimmed length) but it is no longer used to veto edits.

3. `src/components/academy/world/HallwayScene.tsx`
   - In `mergeRoadInto`, replace the "drop every object past the trimmed length" filter with a re-layout of that hallway's objects into the trimmed length using the fit-to-length helper, so doors and branch mouths stay on the road.
   - Child branch junction positions are re-derived from the re-laid-out mouths so branches follow their slot.
   - Multi-pass merge and the residual-overlap assertion pass stay as-is.

4. `src/lib/__tests__/buildingNavigation.test.ts`
   - Cases: a 1-unit gap merges instead of failing; a ~0.05-unit gap snaps flush; objects on a trimmed hallway are all retained within the trimmed length; a merged hallway with added doors still stops at the junction (no length past the target's near wall).

## Verification

Run the navigation unit tests and typecheck, then in the signed-in Academy editor: add doors to a hallway that already merges into another one and confirm no error appears, the corridor stays flush at the junction, the doors remain visible, and walking through the junction still works from both directions with no gap in the floor or ceiling.
