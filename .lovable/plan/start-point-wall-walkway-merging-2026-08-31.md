# Start Point wall + walkway merging

Two separate jobs. Nothing about the hallway shell, doors, ceiling, lighting, camera, nameplates or the Building Map layout changes.

## 1. START POINT — a new editable surface

Today the wall behind you at the entrance is not a designed surface at all: it is a plain flat panel painted with the left wall's colour (no texture, no template, no controls). That is why turning around shows a blank slab.

What changes:

- Add **Start Point** as a sixth building surface, alongside Left Wall, Right Wall, Floor, Ceiling and Terminal Wall.
- Its own section in Building settings, with exactly the same controls the other walls have: template gallery, image upload, colour, zoom/offset, repeat/fit, brightness.
- It renders as a real wall surface at the entrance boundary, using the same wall positioning and orientation logic as the existing walls, so the chosen frame lines up with the floor, ceiling and side walls.
- Per your answer, it applies to the **building entrance only**. Branch hallways keep their current rear boundary behaviour.
- Existing buildings that never had this surface inherit the Terminal Wall design on first load, so no building suddenly shows a white wall.
- Start Point and Terminal Point stay completely independent — separate settings, separate designs, separate storage fields.

## 2. WALKWAY MERGING — a walkway can connect, never pass through

Current behaviour: hallway length is derived (each door or junction added extends the road), and when two hallways end up overlapping the system only resolves it *visually* — one corridor's floor and ceiling are cut where the other passes over, so you can still walk into and through another hallway. That is the bug.

New rule, applied to the geometry itself:

- **Detect.** Every hallway's plan rectangle is tested against every other hallway's. The building already has this maths for the "Connect Hallway" tool, which stops a connector corridor at the target's near wall and opens a mouth there. The same solver now runs automatically for every hallway.
- **Stop at the boundary.** A hallway that reaches another one is trimmed at that hallway's near wall. It never continues past it, and there is no dark slab or invisible barrier to walk into.
- **Merge into a junction.** The hallway it met gains a real opening at the exact meeting point, on the correct wall, with a proper throat: floor, walls and ceiling connect through, no gap. Any door that would have sat at that mouth shifts one slot down the road (existing behaviour for junctions).
- **Navigable both ways.** The navigation graph gains a two-way edge at the merge, so the forward / turn-around / junction controls walk from either hallway into the other.
- **Loops are allowed.** A hallway that comes back round to an earlier hallway merges instead of being refused, so circuits and multi-route mazes are valid. Both routes to the same place work.
- **Continuing past a junction** is done the way you described: add a new hallway from that junction going the other way. The merged hallway itself ends there.
- **Blocked growth** (your choice): if a hallway has merged and you try to add another door to it, the action is refused with a clear message naming the hallway it ends at and pointing you to add from that junction instead. Nothing is silently overlapped or crowded.

## Acceptance

- Turn around at the entrance: a designed Start Point wall frame fills the boundary, matching whatever template was chosen for it, changeable independently of every other surface.
- Walk any hallway that reaches another: you arrive at an open junction, can turn into the other hallway in either direction, and there is no point anywhere in the building where you pass through a wall or see two corridor surfaces through each other.
- Build a route that loops back to an earlier hallway: it connects and both routes are walkable.

## Technical notes

- `src/lib/building/types.ts`: `SurfaceKey` gains `startWall`; `EnvironmentSettings` and `DEFAULT_ENVIRONMENT` gain the matching `SurfaceDesign`.
- `src/lib/building/env.ts`: `mergeEnvironment` merges `startWall` with a fallback chain through `endWall`, so legacy records stay correct.
- `src/components/academy/editor/BuildingSettingsPanel.tsx`: new "Start Point" section modelled on the existing `endWall` section (same `SurfaceEditor`, gallery and upload wiring).
- `src/components/academy/world/HallwayScene.tsx`: the `capStart` branch replaces its plain `meshStandardMaterial` panel with a `Surface` driven by `env.startWall`; texture preloading picks the new key up with the other surfaces.
- `src/lib/building/navigation.ts`: a new `hallwayMerges(...)` pass reuses the `connectorMeeting` intersection maths across all compiled nodes, returning per-hallway `{ trimmedLength, targetId, alongTarget, targetSide }`. `compileNavGraph` applies the trim to node lengths and records the reciprocal edge; derived `hallwayLength` is capped by the trim. Mouths are inserted with the existing `insertGeometricMouth`.
- The over-under deck-hole crossing (`corridorCrossing`, `deckHoles`, `deckLift`) stays in place as a safety net for geometry that still overlaps, but with merging active no new crossing should be produced.
- Editor add-door / add-hallway paths gain the merged-hallway guard and toast message.
