# Path-Based 3D Building Navigation System (Phase 1)

Upgrade the existing 3D Building/Academy walkway experience with a professional,
path-aware navigation system. The existing building, scene, surfaces, walkway
graph and editor are preserved — nothing is rebuilt. The navigation foundation
is built first; visual controls (mini-map, breadcrumbs, indicators) sit on top.

## Current state (verified)

- `src/components/academy/world/HallwayScene.tsx` already renders the walkway
  environment from `building.walkways` and compiles a recursive graph
  (`computeSegments`: parent walkway + forward/left/right children with
  world-space headings and positions).
- Movement is a smooth glide in browse mode: camera lerps to each doorway,
  turns re-orient the camera heading, movement stops at the walkway end
  ("End of walkway" state), and keyboard/touch walk controls exist.
- `BuildingWalkway` rows (id, parent_id, direction forward/left/right, length,
  position) come from `src/lib/building/api.ts` (`addWalkway`, `updateWalkway`,
  `deleteWalkway`) — the graph is already dynamic: new walkways appear when
  saved, no hard-coding.
- `building_doors` rows associate a door with a walkway and a product
  destination; the world page routes course/game doors to their product pages.
- Owner/viewer split exists: editors reach `/academy/edit`, viewers see the
  world at `/academy` and cannot edit.
- The four-surface background asset system (templates, uploads, cover-fit,
  per-surface settings) is implemented and its E2E verification is being
  completed in parallel; this plan does not change it.

## What we build

### 1. Navigation core — `src/lib/building/navigation.ts` (pure, testable)

A typed navigation graph compiled from the walkway rows, independent of the
3D scene so future editors and the mini-map share it:

- `NavNode` per walkway segment: id, name, world position, heading, depth.
- `NavEdge` per connection: previous, forward, left, right, door.
- `availableDirections(node)` — forward/left/right/back with validity flags.
- `turnGeometry(fromHeading, toHeading)` — 90-degree and 180-degree turn
  arcs (position + yaw keyframes) for smooth rotation around the junction.
- `NavigationHistory` — a stack of visited nodes with current node, previous
  node, back availability (Back disabled at the start node).

Unit tests for the pure functions (graph build, availability, turn geometry,
history push/pop).

### 2. Movement state machine — `useNavigation` (inside the scene)

Replace the heading-lerp glide with a node-following state machine:

- `WALKING` — move forward along the current node toward the next doorway;
  camera follows smoothly (lerp on position and yaw, no snapping).
- `TURNING` — at a junction, rotate player/camera around the junction along
  the turn arc, align with the new node, then resume `WALKING` automatically
  (Temple Run-style: turn → align → forward).
- `RETRACING` — Back walks the player along the previous node back to the
  previous node (or a smooth 180-degree turnaround when returning along the
  same walkway), updating history.
- `IDLE` — at a dead end or junction with nothing ahead; Back remains
  available; forward resumes when a path exists.

Input rules (unchanged keys, now graph-routed):

- W / Up / swipe up → forward if a forward path exists, else ignored with a
  subtle "no path" cue (faint edge pulse, no camera movement).
- A / Left / swipe left → turn left only if a left node exists; wall on the
  left → input ignored, no rotation, no clipping.
- D / Right / swipe right → same for right.
- S / Down / swipe down / Back button → retrace history.
- All controls obey the graph; collision stays a secondary safety layer.

### 3. Door interaction (folds in the queued hallway work)

- Doors show a hover highlight matched to the hallway lighting tone
  (emissive ramp, no geometry clipping) and a proximity/click interaction
  state with the door's destination name.
- Clicking/activating a door: pause movement, smooth camera zoom to the
  doorway, then navigate to the destination:
  - Course/game doors → existing product routes (unchanged).
  - Room doors → new `/academy/room/$roomId` leaf route rendering the
    room's sections via the existing showroom panel.
- Door section counts refresh live from the database (realtime subscription
  on the room hierarchy / placements, falling back to poll) so counts stay in
  sync as rooms and courses are added or moved.

### 4. HUD overlays (on top of the navigation core)

- Breadcrumb: `Main Hall / JSS1 / Algebra` from the history stack.
- Direction indicator: `← Main Hall | JSS1 →` style labels from the current
  node's connections.
- Back button: disabled at the start node.
- Mini-map: small expandable button; opens a 2D top-down graph of nodes,
  junctions, doors and destinations with the current position and facing
  drawn from the same `navigation.ts` graph. Uses a lightweight SVG render
  (no second WebGL context).

### 5. Editor integration

- `WalkwayManager` stays the editor surface; the navigation graph is
  recomputed automatically from saved rows (already true via
  `computeSegments`). Verify a newly added walkway immediately appears in
  the world + mini-map, and new doors resolve their destinations.
- No editor changes to navigation data shape.

## Verification (test cases 1–16)

Playwright E2E against `http://localhost:8080` (authenticated owner and
viewer sessions):

1. Straight hallway — forward works.
2–3. Wall on left/right — A/D do nothing (assert camera unchanged).
4–7. Left/right walkway exists — smooth turn into it, auto-realign forward.
8–10. Back returns along previous walkway; dead-end Back stays available;
      junction branches all work.
11. Invalid branch — no wall clipping (camera stays inside corridor bounds).
12. Teacher adds walkway — world + mini-map recognise it after save.
13. Teacher adds door — door shows correct destination and opens it.
14. Viewer navigates but cannot edit (no editor controls in world).
15. Owner edits and previews.
16. Larger building (6+ segments) — frame rate and movement stay smooth.

Unit tests cover the pure navigation functions; typecheck via `tsgo`; the
16-case E2E script lives under `/tmp/browser/navigation/`.

## Out of scope (Phase 1)

- Free-fly / FPS camera — deliberately excluded (path-only).
- New physics/collision engine — collision remains a secondary safety layer
  over graph-determined movement.
- New room interiors, courses, or content engines.
- Multiple hallway templates (deferred to the existing Phase 2 track).

## Technical notes

- Keep all movement frame-rate independent: `delta`-based lerps with
  `THREE.MathUtils.lerp` and clamped delta; smooth-turn keyframes computed
  once per turn.
- Mini-map is DOM/SVG, not a second WebGL scene, to hold the performance
  budget.
- The navigation core is a pure module with no three.js imports so unit
  tests run fast and the editor's preview can reuse it.
- Verify the pending surface-system E2E (template + upload + persistence)
  finishes green alongside this work; it touches the same editor page.