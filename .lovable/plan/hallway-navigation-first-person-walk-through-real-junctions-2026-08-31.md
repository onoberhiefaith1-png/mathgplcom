# Hallway Navigation — first-person walk-through, real junctions, connected graph

The existing 3D building, walkway graph, smooth movement system, doors and map stay exactly as they are. This upgrade makes the movement feel like continuously walking through a connected building, makes side openings read as real hallway intersections, and guarantees the previous hallway is always reachable from the one you entered.

## 1. Continuous first-person forward movement

- Camera is the eyes: no avatar, eye height stays at the current 1.75, no free-fly.
- On entering a hallway the walk starts automatically and keeps moving forward (Temple Run style) instead of waiting for a held key. The hallway visibly comes toward the camera.
- Speed ramps up smoothly on entry and eases down as the hallway end or a junction approaches, so it never stops dead.
- Existing controls are kept and layered on top: forward/back keys and swipes still work, the run button becomes a pause/resume for the auto-walk.
- On reaching a junction the walk eases to a hover and the available directions (forward / left / right / back) light up; choosing one glides through and continues automatically.

## 2. Side openings look and behave like intersections

- Each non-forward child hallway keeps its wall opening, widened and framed as an architectural cut-through: full-height reveal, jamb returns on both sides, matching floor running through, ceiling soffit above — matching the reference image, not a hole in a wall.
- The connected hallway behind the opening remains rendered and lit, so it is visible on approach, with its own ceiling panels receding into depth.
- A wall sign above/next to the opening names the hallway it leads to with a direction arrow, in the reference's style.
- Doors keep the existing recessed door-asset treatment. Openings and doors are visually distinct: opening = wide floor-to-ceiling gap into a lit corridor; door = panelled leaf inside a frame.

## 3. Returning to the hallway you came from

- Entering a hallway never unloads the parent. The parent corridor stays in the scene behind the opening.
- Inside a child hallway the mouth it was entered through is marked with a clickable/selectable connection sign carrying the parent hallway's name ("Main Hallway →"). Clicking it, pressing back, or swiping back retraces through the same opening into the parent and resumes forward walking there.
- The connection is bidirectional in the UI: from the parent the child shows as a named opening, from the child the parent shows as a named connection. The stored tree is unchanged — no new edges, no cycles.

## 4. Structure semantics (unchanged, made explicit in the UI)

- Hallway = pathway; Opening = connection to another hallway; Door = destination that opens the existing course/product page. A door never becomes a hallway.
- Add Hallway / Add Door remain the only two things you attach to a hallway.
- Breadcrumbs and the fixed map keep showing the full connected tree and the current position.

## 5. Reference-matched architecture

- Recessed rectangular ceiling light panels spaced down each hallway, with floor cove/uplight pools as in the reference.
- Clean edges where wall meets ceiling and floor, terminal End Wall on every hallway (already implemented) so there is never a dark void.
- Wall signage text for hallway names, doors and openings, legible at walking distance.
- No floating geometry: door frames, jambs and opening reveals are solid boxes joined to the wall plane.

## Technical notes

- All changes are inside `src/components/academy/world/HallwayScene.tsx` (nav state machine, `BranchOpening`, lighting/signage meshes) plus small wiring in `src/components/academy/world/` HUD controls; `src/lib/building/navigation.ts` layout/graph rules and `src/lib/building/api.ts` are untouched except for adding a pure helper for parent-connection placement, covered by a unit test.
- Auto-walk is added as an `autoRun` flag on the existing machine ref with `delta`-based speed and `Math.exp(-k*delta)` damping; phases (`walking` / `turning` / `retracing` / `zooming` / `idle`) are unchanged.
- No database migration, no schema change, no change to door → course routing.
- Verification: existing building/navigation unit tests, a new test for parent-connection placement, typecheck, and a Playwright pass on `/academy` and `/academy/edit` capturing two frames a moment apart to prove continuous forward motion and a screenshot of a junction plus the return trip.
