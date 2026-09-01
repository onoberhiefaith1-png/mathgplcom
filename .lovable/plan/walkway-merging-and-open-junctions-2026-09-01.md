# Walkway merging and open junctions

Goal: the whole building becomes one connected corridor network. Where a new walkway reaches an existing one it merges into a real open junction — no black gap, no barrier, no corridor passing over or under another. Visual design, walls, floors, ceilings, doors, labels and map styling stay exactly as they are.

## What exists today (verified in code)

- `src/components/academy/world/HallwayScene.tsx` already trims a road at the first road it reaches (`firstRoadMeeting`), cuts a mouth into the target wall, drops the arriving road's end wall and registers a two-way connector so the walker can step through.
- The remaining problem is a second, competing system: the "over-under crossing" pass (the `decks` memo, lines ~2154-2195). For any two segments whose plan footprints overlap it removes the *lower* corridor's floor and ceiling slab across the overlap and lifts decks apart. That missing slab is the black/blocked section, and it is what allows one corridor to read as passing above another.
- Merging also silently fails in three geometric cases, and in each of those the crossing pass takes over and leaves a hole:
  - `connectorMeeting` returns `null` when the roads already overlap (`trimmed < half`) — the exact "returned back onto the original hallway" case;
  - it returns `null` when the meeting point falls within half a hall width of the target road's start or end;
  - parallel/collinear roads (`sin ≈ 0`) never merge, so a road that comes back alongside an existing one just occupies the same space.

## Changes

1. **Retire the over-under crossing behaviour.** Remove the deck-hole/lift crossing pass so no corridor ever loses its floor or ceiling and no corridor is depth-offset above another. Keep the front-pad clamping idea only as an anti-bleed measure for the trimmed end of a merged road, so a deck never runs on past the junction it stops at. `SegmentCorridor` keeps its `deckHoles`/`deckLift` props (harmless, still used for nothing but junction padding) or they are dropped cleanly — no change to how slabs look.

2. **Make merging tolerance-based, in `src/lib/building/navigation.ts`.** Introduce one configurable `JUNCTION_TOLERANCE` and rework `connectorMeeting` / `firstRoadMeeting` so a meeting is reported whenever an arriving road's centreline comes within tolerance of an existing road's footprint:
   - already-overlapping roads snap back to the target's near wall instead of returning `null` (the arriving road is shortened to end flush at the wall, minimum one entry run);
   - meetings near the target's start/end clamp to the nearest valid mouth position on the target rather than being rejected;
   - near-parallel approaches are handled by end-point proximity: if the arriving road's end lands within tolerance of any point on an existing road, it merges there with a mouth on the facing wall.

3. **Guarantee no residual crossing.** After the merge pass, re-solve every pair of segments. Any pair whose footprints still overlap means a merge was missed: the shallower road wins and the deeper road is trimmed back to the overlap boundary and merged there. This is an assertion loop, so tunnelling and stacked corridors become structurally impossible instead of being hidden with a hole.

4. **Open junction geometry.** Each merge continues to insert a `link` mouth into the target hallway's layout, which already removes that run of wall via `wallRuns`. Add the same treatment at the arriving road's stopping face: no end wall (already done), and the target's floor/ceiling carries the junction, so the walker sees continuous deck through the opening.

5. **Navigation and collision follow geometry.** The connector map already gives forward-into-target and target-back-into-road movement; extend it so every merge registers both directions, and so turning at a junction mouth uses the same trimmed lengths the renderer draws. Movement limits derive from the trimmed segment lengths, so collision matches the visible corridor exactly.

6. **Editor guard stays.** `mergeLimits` (used by `AcademyEditorPage`) is updated alongside `connectorMeeting` so growth limits, toasts and the Building Map agree with the new merge rules.

## Verification

- Extend `src/lib/__tests__/buildingNavigation.test.ts`: T-junction merge; a road that already overlaps an existing one; a meeting near a road's end; a near-parallel return; and the North 2 / West 1 / South 1 / East 1 loop, asserting it closes onto the original road with one shared junction and no crossing pair remains.
- Playwright walk-through of the junction from all four approach directions, screenshotting the deck at the junction to confirm no black gap and no flicker.
