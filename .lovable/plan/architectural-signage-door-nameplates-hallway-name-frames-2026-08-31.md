# Architectural Signage: Door Nameplates + Hallway Name Frames

The junction fix is in place. This plan replaces the last piece of "floating text" in the building with two real, physically mounted sign types. Nothing else in the building changes: geometry, junction, doors, walls, ceiling, lighting, materials, camera, navigation and the Building Map are untouched.

## What is wrong today

Three separate bits of bare 3D text act as labels:

- The course/door name and its kind float above each door frame as loose glowing text.
- Each hallway's own name (for example "H-J-Y") is drawn as text hanging near the ceiling, 1.5m inside the hallway — this is the ceiling label you saw next to the Building Map.
- A branch's name is drawn as text plus an arrow floating beside its mouth, and the endpoint name floats on the end wall.

All of them are already inside the 3D scene (drei `Text`), so they respect perspective, but none of them is a designed object — they read as HUD text.

## What gets built

### 1. One reusable plaque object

A single `Nameplate` component: a navy plaque mesh (rounded rectangle, real thickness, soft contact shadow) with white uppercase bold text centred on its face, plus a thin lighter bevel edge so it catches the hallway light.

- Height, corner radius, padding, font and colour are fixed constants — every sign in the building is identical in style.
- Width is computed from the text length, so ALGEBRA is compact and QUADRATIC EQUATIONS is wider, with the same padding either side.
- Very long names cap the plaque width and wrap onto a second line inside the plaque (plaque grows in height by one line rather than shrinking the text) — no overflow, no clipping, no tiny text.
- It is a plain mesh group: it inherits its parent's transform, so it always keeps its exact position and perspective.

### 2. Door nameplates

Each plaque is mounted inside the existing door group, above the lintel, with a fixed small gap between plaque bottom and door frame top and a guaranteed clearance to the ceiling. Because it is a child of the door, it moves with the door automatically and can never drift.

- Text comes straight from the door's assigned product title (the same value the door already resolves), uppercased. Reassigning the course updates the plaque with no manual editing.
- The secondary "Course / Game / Assessment" line becomes a small caption on the plaque face under the name (same plaque, not a second floating string), so the hierarchy is Door → frame → plaque → name.

### 3. Hallway name frames

The ceiling text and the floating branch text are removed and replaced with a `HallwayNameFrame`: the same plaque language, larger, mounted flat against a wall as a sign board.

Placement is derived per hallway from its own geometry, never a global fixed position:

- A hallway you approach from a junction gets its frame on the wall directly across from its mouth, facing the incoming direction — you look at the mouth and read the hallway's name on the wall behind it.
- A hallway that ends in a wall also carries its endpoint name on that end wall as a frame, replacing the floating endpoint text.
- Both sit at architectural eye level, horizontally centred on their wall panel, with a fixed margin from the ceiling, and are kept off door positions and off the junction mouth so nothing overlaps.

```text
        [ ALGEBRA ]              PLAYER
        ┌────────┐                  |
        │  DOOR  │            ┌───────────┐
        └────────┘            │   H-J-Y   │
   door name above the door   └───────────┘
                             hallway frame on the
                             wall facing the mouth
```

The frame text reads `walkway.name` from the same navigation data the Building Map uses, so renaming a hallway updates both at once. No hallway name is hard-coded, and the Building Map is not touched.

## Acceptance

Walking the whole building: every door shows its course name on a navy plaque directly above it; every named hallway shows its name on a wall-mounted frame facing the approach; nothing floats near the ceiling, nothing is fixed to the screen, no clipped or overlapping text, and turning or walking backwards leaves every sign exactly where it is installed.

## Technical notes

- All work is in `src/components/academy/world/HallwayScene.tsx`, using the drei `Text` already imported — no new rendering system, no HTML overlay.
- New components: `Nameplate` (shared plaque primitive) and `HallwayNameFrame` (wall-mounted variant). Both pure presentation.
- Removed: the loose `Text` at the ceiling in `SegmentCorridor` (hallway name), the `endName` text, the branch-mouth name/arrow text in `BranchOpening`, and the two label strings in `DoorMesh`.
- Plaque geometry uses `THREE.Shape` + `ExtrudeGeometry` for the rounded profile, drawn once per width and memoised; text width is estimated from character count against the fixed font size, so no async measurement is needed.
- Click targets, hover behaviour, door entry, branch entry and the back connection all keep their current meshes and handlers unchanged.
- Verification: walk the building in the browser at several camera positions and compare frames for flicker or drift.
- `roadmap.md` gains this signage task when the build starts.
