# Correct two-way maze movement and hallway intersections

## Outcome
- Forward and backward movement remain fully press-and-hold: movement starts only while a control is held and stops on release.
- Backward performs a smooth about-face, then retraces the exact route through every previous junction instead of becoming stuck or reversing itself again.
- Left/right actions are available only at the opening beside the player and turn into that connected road; they cannot jump into a distant branch.
- Any corridor that reaches another hallway stops at that hallway’s wall, cuts a real opening, and hands the player into the intersected hallway. No road or map line continues across another road.
- The fixed-size GPS map uses the same corrected, clipped geometry as the 3D building.

## Implementation
1. **Make movement input reliable**
   - Track held keyboard and pointer intent separately so key-repeat, pointer-leave, or a turn animation cannot cancel a legitimate hold.
   - Keep the hold active through an about-face; releasing during the turn prevents movement when the turn finishes.
   - Preserve signed travel direction across segment handoffs and stop velocity only at a genuine wall/dead end.

2. **Repair reverse route handoffs**
   - Resolve a child’s parent mouth by the opening’s child ID, matching the actual hallway layout data.
   - When leaving a child from its start, place the player at that exact parent junction and preserve the backward-facing heading.
   - Support the same two-way transition for connector corridors, including returning from the target hallway into the connector.

3. **Make junction turns local and graph-valid**
   - Bind left/right controls to the opening currently within reach rather than the first child anywhere on the hallway.
   - Turn smoothly into the selected hallway’s true heading and continue only while the movement control remains held.
   - Keep wall collision behavior: invalid directions do not rotate or move the player through a wall.

4. **Stop roads at real intersections**
   - Replace the perpendicular-only connector trim with angle-aware line/intersection math using corridor width and wall thickness.
   - Run a layout intersection pass that finds the nearest valid hallway hit, clips the approaching road at the near wall, and records the exact target distance and side.
   - Use that one resolved connection for corridor length, terminal-wall removal, target wall opening, navigation handoff, and map line endpoints.
   - Ignore shared parent mouths and endpoint touches so normal branches are not shortened accidentally.

5. **Regression coverage and visual verification**
   - Add unit tests for 60° and 90° corridor trimming, no-crossing endpoints, exact parent-mouth lookup, and direction-preserving reverse handoffs.
   - Verify in the authenticated Academy preview: hold forward, release, about-face/backtrack across multiple junctions, enter left/right branches, traverse a loop both ways, and confirm the 3D corridor and map both stop at the same opening.
   - Check desktop and mobile control behavior and confirm there are no runtime, console, or missing-asset errors.

## Technical scope
- `src/components/academy/world/HallwayScene.tsx` — input state, movement/handoff logic, local junction selection, shared resolved geometry, 3D rendering, and map rendering.
- `src/lib/building/navigation.ts` — angle-aware intersection and clipping helpers.
- `src/lib/__tests__/buildingNavigation.test.ts` — deterministic geometry/navigation regressions.
- No database or content migration is required; existing hallway and connection records remain compatible.
