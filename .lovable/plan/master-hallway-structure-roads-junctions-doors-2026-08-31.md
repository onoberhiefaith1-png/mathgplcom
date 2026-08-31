# Master Hallway Structure — Roads, Junctions, Doors

The existing 3D building, first-person walk, doors and course routing stay. What changes is the
structural model underneath: a hallway is a **road**, "Add Hallway" creates a **perpendicular
branch**, "Add Door" places a **destination**, and hallway length becomes automatic.

## 1. The model (built first, before any UI change)

```text
BUILDING
└── HALLWAY (road)
    ├── Doors            → destinations on the left/right wall
    ├── Junctions        → perpendicular openings to other hallways (left or right)
    └── Terminal Wall    → the physical end of this road
```

- A hallway has one parent junction and unlimited child hallways.
- A child hallway is always 90° to its parent: **Left** or **Right** only.
- "Forward" / "Extend" is removed as a user choice. A hallway is a continuous road.
- Doors and junctions are three distinct things: Terminal Wall (end), Junction (opening into
  another road), Door (destination). Never interchangeable.

## 2. Junctions sit along the road, not only at its end

Today every branch is attached at the parent's far end, which is why "Add Hallway" produces no
visible change and no branch on the map. New behaviour:

- Each child hallway stores **how far along** the parent it connects (`junction_at`).
- New branches are placed automatically at the next free slot along the parent, keeping the
  existing rule that no two objects (door or opening) sit directly opposite each other.
- The junction position is editable, so a teacher can slide a branch further down the road.

## 3. Hallway length becomes automatic

- Length is derived from the number of doors + junctions on that hallway, with a comfortable
  minimum, so adding a door lengthens the road by itself.
- The manual "Hallway length" number field is removed from the editor.

## 4. Add Hallway must change the building immediately

After creating a branch, in the same action:

- the 3D world renders the perpendicular opening (frame, jamb, visible corridor beyond, its own
  walls / floor / ceiling / lighting) so you can see into it before entering,
- the Building Map gains the branch line and node,
- the editor camera moves to the junction so you are standing at what you just made.

Both the 3D world and the map are generated from the same compiled graph, so they can never
disagree.

## 5. Navigation follows the structure

- First-person, no avatar, existing Temple-Run forward motion kept.
- Arriving at a junction: choose Left / Right to enter, or continue forward.
- Entering a branch makes that hallway the road ahead and leaves the parent hallway **beside and
  behind you**, with its named connection clickable to return. Nothing unloads.
- Back retraces along the actual path from the entrance.

## 6. Map orientation

- The map is rotated 180°: the entrance sits at the **bottom** and travel reads **south → north**
  (upward), so the map matches the direction you are actually walking.
- Left/right branches draw on the same side the player sees them.
- The frame stays fixed at the top-right and never rotates with the walker; only the position
  marker and its facing chevron move.

## 7. Settings must drive the visible building

- The five surfaces are **Left Wall, Right Wall, Floor, Ceiling, Terminal Wall** (the "End Wall"
  label is renamed to Terminal Wall everywhere in the UI).
- Selecting a design/colour/texture for any one surface updates that surface only, live in the
  preview, and persists per building.
- Lighting and effects likewise apply immediately; the corridor is never a dark void, and every
  hallway that does not continue always renders its Terminal Wall.

## 8. Terminology cleanup

Room / Add Room / Add Section disappears from the building editor. The panel offers exactly:
**+ Add Hallway** (connect to, Left/Right, name) and **+ Add Door** (hallway, name, door style,
product). Existing academy tables and data are left untouched.

## Technical notes

- Migration: add `building_walkways.junction_at` (fraction along the parent, default centred).
  Keep `direction` but stop writing `forward` for new rows; existing `forward` rows continue to
  render as a straight continuation so no current building breaks.
- `src/lib/building/navigation.ts`: `compileNavGraph` places a child at
  `parentStart + heading * (junction_at * parentLength)` instead of the parent's end;
  `layoutHallwayObjects` gains derived hallway length (`lengthForObjects`) and reserves the
  junction slots; add `availableDirections` guard for one Left + one Right per junction slot.
- `src/components/academy/world/HallwayScene.tsx`: render mid-hallway openings (frame + visible
  child corridor with its own surfaces and ceiling lights), branch entry glide, parent connection
  sign, and regenerate the minimap from the graph with the flipped orientation.
- `src/components/academy/editor/WalkwayManager.tsx`: Left/Right only, drop the length field, add
  junction-position control, keep rename/delete and the door dialog.
- `src/lib/building/{types,env,api}.ts`: `endWall` label → "Terminal Wall", `junction_at` in the
  walkway type and CRUD, derived length no longer sent from the client.
- Tests in `src/lib/__tests__/buildingNavigation.test.ts`: mid-hallway junction geometry, derived
  length growth per door, one-branch-per-side guard, no-opposite-objects rule, map orientation.

## Verification

- Unit tests (navigation + environment) green; typecheck clean.
- Signed-in browser pass: add a Left hallway → see the opening in 3D and the branch on the map in
  the same step → add doors and watch the road lengthen → walk in, walk back out → branch again
  from the child → change Terminal Wall design and see it change → reload and confirm everything
  persisted → open a door and land on the existing course page unchanged.
