# Building Structure: Hallways, Doors, and a Live Navigable Editor

The existing 3D building, navigation engine and map stay in place. This change corrects the
editing model so the building is a tree-shaped maze of hallways with doors as destinations,
and makes the Edit scene as navigable as View World.

## 1. One model: Hallway = path, Junction = decision point, Door = destination

- The building structure panel offers exactly two actions: **+ Add Hallway** and **+ Add Door**.
- "Room", "Add Room", "hallway section" and the Room/Category/Topic/Subtopic tree are removed
  from this editor panel, and rooms are no longer injected into the corridor as objects.
  Existing academy tables and data are left untouched — nothing is deleted from the database.
- Every hallway has exactly one parent and unlimited children. Branches can nest indefinitely
  and can never reconnect to another branch, so the structure stays a tree with no loops.

## 2. Add Hallway becomes an explicit branch dialog

Clicking **+ Add Hallway** opens a small form instead of silently appending a segment:

```text
ADD HALLWAY
Connect to:  [ Main Hallway ▾ ]   (any existing hallway/junction)
Direction:   ( ) Forward   ( ) Left   ( ) Right
Name:        [ Algebra Hallway ]
                                   [ Create Hallway ]
```

- The connect-to list shows the hallway tree by name and depth.
- A direction already used on that parent is disabled (one forward, one left, one right per
  junction), which is what keeps the graph a tree.
- On create, the hallway is written with `parent_id` + `direction`, the world refreshes, and
  the editor camera moves to the new hallway so the teacher immediately stands in it.

## 3. Add Door becomes an explicit destination dialog

```text
ADD DOOR
On hallway:  [ Algebra Hallway ▾ ]
Door name:   [ Statistics ]
Opens:       [ Course | Game | Adventure | Assessment ] → pick product
Door style:  [ gallery of the uploaded door assets ]
                                   [ Create Door ]
```

- The door attaches to the chosen hallway, keeps the existing automatic wall placement and
  spacing (no two doors opposite each other), and opens the existing product page unchanged.

## 4. The Edit scene is a live navigable world

- The Edit preview uses the same walk navigation as View World: move forward, choose
  Forward/Left/Right at a junction, Back to retrace, and approach doors.
- Door clicks in Edit select that door in the panel (instead of only showing a toast), so
  build and inspect are one loop: add → world updates → walk there → add the next piece.
- Turns stay simple: a short 90° reorientation with no cinematic sequence and no teleport
  flash; what changes is which hallway and doors are in front of the walker.

## 5. The map stays a fixed floor plan

- The map keeps its fixed orientation: it never rotates and never flips with the walker.
- Only the position marker and its facing chevron move; the active route highlights along the
  path from the entrance. Back always follows the parent link one level outward.

## Technical notes

- `src/pages/academy/AcademyEditorPage.tsx`: drop the room/category/topic/subtopic tree and the
  "Add hallway section"/"Add section" buttons; header becomes "Building structure" with the two
  add actions; pass `rooms={[]}`-equivalent (scene no longer requires rooms) and wire door
  selection from the scene.
- `src/components/academy/editor/WalkwayManager.tsx`: replace inline add buttons with the two
  dialogs above; add the per-parent direction guard and the connect-to selector.
- `src/components/academy/world/HallwayScene.tsx`: stop building `room:` hallway objects and
  stop deriving corridor length from `rooms`; make `rooms` optional; enable walk navigation and
  door selection in the editor instance. Map rendering is unchanged.
- `src/lib/building/navigation.ts` and `layoutHallwayObjects` keep being the single source of
  truth for the graph and object placement; add tests for the direction-availability guard
  (no duplicate direction per parent, single parent per hallway).
- No schema change is needed: `building_walkways.parent_id`/`direction` and `building_doors`
  already model the tree.

## Verification

- `buildingNavigation` / `buildingEnv` tests plus new guard tests.
- Signed-in browser pass: add a left branch off the main hallway, add a sub-branch off it, add a
  door on each, walk from the entrance into the sub-branch and back, reload, and confirm the
  structure, doors and map marker all match.
