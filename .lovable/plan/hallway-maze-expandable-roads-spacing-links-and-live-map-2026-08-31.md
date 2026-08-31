# Hallway maze: expandable roads, spacing, links and live map

Goal: the building becomes one continuous, expandable road network. A hallway is the road; doors are objects placed along it. No "extend" control, no per-hallway branch limit, no crowding, and hallways may reconnect to hallways that already exist.

Movement (hold-to-walk) already behaves correctly and is not touched except where a new connection type needs to be walkable.

## 1. Fixed spacing along every road

Today object positions are spread evenly over the corridor, so spacing changes every time something is added. Replace that with fixed slots:

- One standard interval (`SPACING`) between any two objects — door/door, door/junction, junction/junction.
- Slot index = the order in which the object was added; distance = `pad + index * SPACING`.
- Road length is derived from the highest occupied slot plus end clearance, so the road grows automatically as things are added and never stops at a fixed length.
- Doors keep alternating walls; a junction stays on the wall its branch leaves through.

## 2. Doors sit inside the hallway, never at a mouth

- Minimum clearance is enforced between a door slot and any junction slot on the same road (a door can never be adjacent to an opening).
- A branch road reserves an entry run before its first slot, so from the parent hallway you cannot see the branch's first door — you must walk in.

## 3. Unlimited branches, any direction

- Remove the one-left/one-right cap: a road accepts as many branches as slots exist, alternating sides in add order.
- Sides continue to alternate automatically; the teacher never picks a direction.
- Forward continuations still extend the same road.

## 4. Reconnection: hallways can join to form a maze

New concept: a **connection** between two existing hallways, stored separately from the parent/child tree so loops become possible without breaking the existing structure.

- New table `building_walkway_links` (building, from-hallway, to-hallway, slot on each side) with grants, RLS matching `can_edit_building` / `can_view_building`, and indexes.
- In the editor, a hallway gains a "Connect to existing hallway" action listing other hallways; creating the link takes the next free slot on both roads.
- The 3D scene renders a link exactly like a branch mouth on both sides (real wall thickness, splayed reveal, soffit), so a loop looks identical to a branch.
- Navigation treats links as extra edges: turning through a link moves the walker into the linked road at its mouth, in either direction, with the same eased yaw as a branch.
- No wall collision: the wall run on each side loses the gap the link occupies.

## 5. Backward navigation everywhere

- Back is always available: from a branch it returns through the mouth it came from; from a link it returns through the link.
- Turnaround remains an in-place eased 180°, never a teleport.

## 6. Live map = real structure

- The minimap already draws from the shared layout function; extend it to draw links as connecting lines between the two roads, and branch stubs the moment a hallway is created.
- Building data already refreshes in realtime; links subscribe to the same channel so the map and the 3D geometry change immediately after Add Hallway / Add Door / Connect.

## Implementation order

1. Slot-based spacing + derived road length (`navigation.ts`, `HallwayScene.tsx`).
2. Door/junction clearance and branch entry run.
3. Unlimited branches (`freeBranchDirections` removal, editor auto-side).
4. Links: migration, `api.ts` read/write, editor action.
5. Link geometry in the scene (mouth + wall runs) and link edges in navigation.
6. Backward through links; map rendering of links.

## Technical notes

- `layoutHallwayObjects` becomes slot-based (`slotAlong(index)`), and `lengthForObjects` is derived from the maximum slot; both stay the single source of truth shared by the 3D scene and the minimap.
- `compileNavGraph` keeps the tree for geometry, and gains an adjacency map that includes links, so `availableDirections` can offer a turn through a link.
- Junction rendering reuses the existing `junctionGeometry` solver — links pass the same solved mouth, so no new geometry code paths.
- Unit tests extend `src/lib/__tests__/buildingNavigation.test.ts`: fixed spacing, door/junction clearance, unlimited branches, link traversal in both directions, and loop graphs terminating.
- No visual redesign, no movement changes, no changes to doors' product wiring.
