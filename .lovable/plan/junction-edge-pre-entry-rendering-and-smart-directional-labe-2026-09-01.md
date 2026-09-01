# Junction edge, pre-entry rendering, and smart directional labels

## Goal
Finish the hallway junctions without changing the rest of the building: eliminate opening-edge flicker, fully render every connected hallway before entry, and make every junction plaque name the hallway the viewer is about to enter while remaining physically mounted on a wall.

## Confirmed causes
- At merge openings, the wall is cut to the clear mouth width, but each jamb and the lintel extend beyond that cut into the surviving solid wall box. Those opaque meshes occupy the same volume and flicker.
- Hallway shells exist before entry, but lights, doors, openings, and labels are limited to the current hallway plus its parent/children. Hallways connected through merge links are excluded, so they appear as dark empty masses until navigation switches into them.
- Parent-to-child plaques correctly use the destination name and mouth geometry. The reverse path uses `ParentConnection`, which places a plaque on the corridor centreline rather than a wall. Merge corridors also lack a symmetric destination plaque, so the visible sign can incorrectly name the hallway the viewer is already standing in.

## Changes

### 1. Make every opening edge single-owner geometry
- Treat the mouth span as the complete architectural cut, including the jamb and lintel footprint.
- Move merge jambs inside the cut boundary, matching the already-correct branch-opening construction.
- Keep the lintel inside exactly the same cut limits instead of extending into the surviving wall runs.
- Make wall runs, jambs, lintels, floor reveals, and ceiling reveals meet only at shared boundaries; no overlap, depth bias, transparency, or UI-layer workaround.
- Preserve existing wall materials, floor, ceiling, doors, dimensions, lighting style, and junction layout.

### 2. Render connected hallways before the viewer enters
- Replace the narrow parent/child-only visibility set with a graph-neighbour set that includes both directions of branch, forward, explicit-link, and automatic-merge connections.
- Mount the connected hallway's local lights, doors, openings, and architectural details whenever its mouth is visible from the current hallway.
- Include reverse connector lookups so an arriving corridor and the hallway it joins illuminate each other from either side.
- Keep distant unrelated corridors culled; only the current hallway and directly visible connected neighbours are expanded.
- Do not alter global fog, material brightness, or the building's lighting design—the fix is to render the correct connected scene content at the correct time.

### 3. Replace static labels with directional destination plaques
- Use one rule at every opening: **the plaque names the hallway reached by passing through that opening**.
- From Entrance Hall looking into YU, show `YU`.
- After entering YU and turning back, replace that junction-facing plaque with `ENTRANCE HALL`.
- When the viewer crosses again, recompute the visible destination from the current hallway and facing direction, so the label always describes what lies ahead rather than where the viewer already stands.
- Register both sides of branch, merge, and explicit-link junctions in the connection model so each side has the correct destination name.
- Remove the centreline `ParentConnection` plaque and derive both forward and reverse plaque transforms from the real mouth geometry and surviving wall runs.
- Mount every plaque flush to a verified wall face at eye level. If no valid wall host exists, do not draw it in open space.
- Keep door nameplates and genuine dead-end hallway identity plaques unchanged, except suppressing a dead-end identity plaque where the end is actually an open junction.

## Technical work
- `src/components/academy/world/HallwayScene.tsx`
  - Correct `MergeOpening` jamb/lintel bounds.
  - Expand connected-neighbour rendering through the connector graph.
  - Replace `ParentConnection` with geometry-anchored, direction-aware junction signage.
  - Pass current segment/facing into destination-label selection without changing movement or camera behaviour.
- `src/lib/building/navigation.ts`
  - Add pure helpers for complete mouth bounds, bidirectional adjacency, and destination-label resolution.
  - Reuse the same junction geometry for wall cuts and plaque anchors.
- `src/lib/__tests__/buildingNavigation.test.ts`
  - Prove jamb/lintel footprints stay inside wall cuts.
  - Prove branch and merge adjacency works in both directions.
  - Prove labels swap `YU` ↔ `ENTRANCE HALL` when current hallway/facing reverses.
  - Prove no plaque anchor lies on the corridor centreline.

## Verification
- Run the targeted building navigation/geometry tests and TypeScript checks.
- Authenticated Playwright walkthrough at the reported junctions:
  1. Approach from Entrance Hall and confirm the connected corridor is textured and lit before entry.
  2. Inspect both opening posts and lintel while moving and turning; acceptance is zero flicker, flashing, or overlapping wall faces.
  3. Enter YU, turn around, and confirm the wall plaque changes to `ENTRANCE HALL` in the same architectural sign position.
  4. Cross back, turn again, and confirm the plaque changes back to `YU`.
  5. Repeat from a merge-created junction in both directions and confirm no label appears in the walking path.
- Compare screenshots from approach, threshold, inside-looking-back, and reverse approach.

## Scope guard
No redesign of corridors, materials, textures, doors, lighting style, camera controls, Building Map, editor controls, gallery assets, data model, or unrelated pages.
