# Doors never stand in the road — hallway capacity and one shared sequence

## What is actually wrong (verified in code)

1. `fitObjectsToLength` (`src/lib/building/navigation.ts`) squeezes every object of a
   merged hallway into the run before the junction, but it has no capacity limit. When the
   objects need more room than the shortened road has, the start clamps to `0` and the last
   slots run **past** the usable run — straight into the junction throat. That is the door
   standing in the middle of the road in the screenshot.
2. The Add Door form (`src/components/academy/editor/WalkwayManager.tsx`) lists every
   hallway, including one that is already full between its two junctions, so a door can be
   added where there is physically no wall left for it.
3. That same form submits every new door with a fixed `position_along: 0.5`, instead of the
   next slot in the hallway's sequence. Doors therefore do not fall in after the hallways and
   doors already on that road — a new door can land before an existing junction.

## What changes

### 1. A hallway has a hard, shared capacity

Add one capacity rule in `navigation.ts` used by both the renderer and the editor:

```text
usable   = length − junction clearance
capacity = 1 + floor(usable / MIN_OBJECT_SPACING)
```

- `fitObjectsToLength` never places an object beyond `usable`. If the object count exceeds
  capacity, the overflow keeps its wall slot but is clamped inside the usable run and the
  hallway is reported as full — nothing is ever positioned in the throat, and nothing is
  silently deleted.
- A helper `hallwayCapacity(...)` / `isHallwayFull(...)` returns, for each hallway, how many
  more objects it can still carry. A hallway that is not merged (still free to grow) always
  reports capacity available, because adding a door simply lengthens it.

### 2. Full hallways disappear from the Add Door list

- The Add Door hallway selector only lists hallways with room left. A hallway that starts at
  one junction and ends at another and is filled to its door spacing is simply absent from
  the list.
- No error text, no toast, no "too many doors" message anywhere in this flow.
- If a hallway is preselected (Add Door here on a full row) that row's Add Door action is not
  offered at all, for the same reason.

### 3. Doors and hallways share one alternating sequence

- New doors take the next sequence slot computed from **both** existing doors and existing
  junctions on that hallway (the same `nextObjectOffset` rule the hallway and connection
  flows already use), instead of the hardcoded `0.5`. A door created after a hallway lands
  after that hallway on the road.
- Side alternation stays as it is: each object takes the wall opposite the previous object,
  so the road reads right, left, right, left across doors and hallway mouths alike.

## Technical notes

- `src/lib/building/navigation.ts`: add `hallwayCapacity` / `remainingObjectSlots`, clamp
  placement in `fitObjectsToLength` to the usable run, keep `JUNCTION_CLEAR` and
  `MIN_OBJECT_SPACING` as the single source of truth.
- `src/components/academy/editor/WalkwayManager.tsx`: filter the door hallway list by
  remaining slots; replace `position_along: 0.5` with the next combined sequence slot.
- `src/pages/academy/AcademyEditorPage.tsx`: pass the per-hallway remaining-slot map (derived
  from `mergeLimits` + layout lengths) into the manager.
- Tests in `src/lib/__tests__/buildingNavigation.test.ts`: no object beyond the usable run at
  any object count; capacity maths; door sequencing after a junction.
- No changes to materials, textures, doors' artwork, lighting, camera, Building Map or the
  junction geometry itself.

## Verification

- Unit tests plus typecheck.
- Signed-in walk: on the hallway from the screenshot, confirm the door has moved back onto a
  wall run before the junction, keep adding doors until that hallway drops out of the Add
  Door list, and confirm no door ever appears in a junction throat.
