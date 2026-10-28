# Final Hallway System — Movement, Extension & Connection

Scope: the Academy 3D building only (hallway navigation, hallway geometry, Connect Hallway, Building Map). No UI redesign, no unrelated features.

## What changes

### 1. Movement becomes fully user-driven, both directions
- Forward and Backward are both press-and-hold. Speed ramps smoothly up on press and down to zero on release; the camera never travels on its own, in View or Preview/Test mode.
- Backward first turns the camera 180° in place (short eased turn), then walking continues in that direction for as long as Backward is held. It is a real about-face, not a reverse strafe.
- The scripted "retrace to junction" behaviour is removed: no auto-glide, no teleport, no snap.
- Keyboard: hold ArrowUp/W = forward, hold ArrowDown/S = backward.

### 2. Junctions never stop movement
- Walking is continuous across hallway boundaries. When the walker reaches the end of a hallway that continues (a forward continuation, a branch they have entered, or a connection), holding the walk button carries them through the junction throat into the connected hallway with an eased heading change — no invisible barrier, no dead end, no separate "turn" gate needed to keep going.
- Where more than one route leaves a junction, the existing junction buttons choose the route; picking one simply switches the walker's road and keeps their momentum instead of stopping them.
- Only a genuine endpoint (a hallway with a terminal wall and nothing beyond it) stops the walk.

### 3. Two-way traversal everywhere
- Every connection is registered in both directions: parent→branch, branch→parent, and both ends of a Connect Hallway corridor. Walking backward out of a branch continues into the parent hallway at the exact junction point, then keeps going down the parent while Backward is held.
- No hallway can trap the walker; this holds through loops and any number of connections.

### 4. Hallways stay continuous roads that extend themselves
- Hallway length continues to be derived from what sits on it (fixed 7.5 m slots), so adding a door or a hallway grows the road automatically. No Extend control is added.
- Every hallway — main, branch and connector — is built from the same shell: left wall, right wall, floor, ceiling, terminal wall only where it truly ends, plus doors and openings along it.

### 5. Doors are never at a junction edge
- Clearance rules are tightened: a door can never occupy the slot next to any mouth (branch opening or connection), and the entry run at the start of any hallway you walk into is kept long enough (12 m) that its first door is not visible from the hallway you came from. The same clearance is applied at both ends of a connector corridor.

### 6. Connect Hallway builds a real corridor
- Connect Hallway stops being a map line. It creates a genuine navigable corridor between the two chosen hallways with floor, both walls, ceiling, standard hallway width, standard lighting and object slots, so doors can be added to it later.
- The corridor leaves hallway A through a real angled/perpendicular mouth and runs until it meets hallway B, where it **stops at B** — it never passes through or overlaps B. Both ends become open, walkable junctions with jambs and a soffit, never a dark blocking wall and never an invisible collision.
- If a straight run cannot reach B, the corridor is built as two legs with one corner rather than crossing anything.

### 7. Reconnection and mazes
- When a corridor reaches an existing hallway, the system detects it, trims the corridor at that hallway and creates the opening rather than adding an overlapping road. That yields loops, U-turns, cross-connections and multiple routes between the same two places, all walkable in both directions.

### 8. Building Map behaves like GPS
- The map keeps a fixed UI size and a fixed scale as the building grows. Instead of shrinking the whole network, it pans a viewport that follows the walker, keeping their marker and the surrounding part of the maze in view.
- The map is drawn from the same layout data as the 3D scene (hallways, junctions, connector corridors, doors, endpoints), so it can never show a structure the building does not have, and it updates live on every add/extend/connect.

## Technical notes

- `src/lib/building/navigation.ts`
  - Layout/length helpers stay the single source of truth. Add connector-corridor solving: given two hallways and their slot positions, compute the corridor start point, heading, trimmed length at the target hallway's centre line (minus half hall width) and the induced opening on the target; fall back to a two-leg path when a straight run would cross another hallway.
  - Graph compilation gains connector nodes and an adjacency map with reciprocal edges (`from`/`to`, entry distance and heading on each side) so traversal works in both directions, including loop edges.
  - Add clearance so a door is never adjacent to a mouth on either side, and connector ends carry the entry run.
- `src/components/academy/world/HallwayScene.tsx`
  - `Machine` gains a signed input intent (`hold: -1 | 0 | 1`) plus a pending about-face; `retracing` is deleted. The frame loop integrates signed velocity, and when `dist` passes either end of the segment it hands off through the adjacency map (segment swap + eased yaw, position preserved through the throat) instead of clamping.
  - Connector corridors render with the existing `SegmentCorridor` / `HallwayJunction` primitives so they get walls, floor, ceiling and lighting identical to other hallways.
  - `WalkControls`: Backward becomes a hold button with the same pointer/keyboard handling as Forward.
  - `MiniMap`: fixed pixel box and fixed metres-per-pixel scale with a viewport translated to follow the walker; connector corridors are drawn as real corridor lines, not dashed hints.
- `src/lib/building/api.ts` / `types.ts`: connector links persist their solved geometry inputs (from/to hallway, positions) and the derived corridor is computed at load, so no schema churn beyond what already exists in `building_walkway_links`.
- `src/lib/__tests__/buildingNavigation.test.ts`: add cases for reciprocal adjacency, connector trimming at a target hallway, no-overlap fallback, door/mouth clearance, and map viewport scaling.

## Verification

Unit tests for layout/adjacency/connector geometry, then a Playwright pass through the acceptance sequence in the running app: build main hallway + doors, confirm auto-extension, add a branch, hold Forward through the junction into the branch, release and confirm an immediate stop, hold Backward and confirm the about-face plus return into the main hallway, add a nested branch and doors, use Connect Hallway and walk the resulting corridor in both directions, confirm it stops at the existing hallway with an open junction, and confirm the map matches the maze, stays a fixed size and keeps the walker visible.
