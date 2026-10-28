# Junction geometry repair — single-owner surfaces

## Confirmed diagnosis

Authentication succeeds and the building is reachable. Code inspection confirms the remaining glitch is geometry-level, not a UI layering issue:

- The renderer has `deckHoles` and `deckLift` support, but the hallway render call never supplies either value. Junction floors and ceilings therefore remain uncut.
- A branch throat can contain the parent slab, the branch slab extending backward, and a separate triangular junction patch in almost the same plane.
- A merge throat adds another floor/ceiling patch above the target hallway's uncut slab using only a tiny height offset. That can still flicker and produce shadow/depth artifacts while moving.
- Very short merged hallway stubs can still render a complete corridor shell directly against the target geometry.
- The collision solver uses a fixed number of passes, so a complex chain of merges needs a final residual-overlap check rather than assuming every conflict was resolved.

## Plan

### 1. Record the live failure from several directions

- Enter the Academy with the authenticated session and walk every available merged junction.
- Capture each affected junction while approaching, standing in the throat, looking back, and entering from the connected hallway.
- Record whether each visible defect is on the floor, ceiling, wall edge, jamb, door, or label before changing geometry.

### 2. Give every junction surface one owner

- Build a junction footprint for each branch and merge from the actual hallway headings, width, wall thickness, and meeting point.
- Cut that footprint out of the parent hallway floor and ceiling instead of placing another patch over an intact slab.
- Stop the arriving hallway slabs exactly at the boundary of the junction footprint.
- Let one dedicated junction mesh own the floor and ceiling inside the throat; adjacent corridor slabs meet its boundary without overlap or gaps.
- Remove the small `0.028`/`0.032` overlay offsets as the primary fix. Physical segmentation, not depth bias, will prevent flicker.

### 3. Rebuild branch and merge throats as explicit geometry

- Keep branch and merge openings separate: branches use their real departure angle; merges use the actual measured intersection angle.
- Generate the throat floor, ceiling, jamb reveals, lintel, and short wall returns from the same footprint so all edges share identical coordinates.
- Do not let the branch corridor extend backward beneath its parent slab.
- Suppress a near-zero-length corridor shell and absorb it into the junction when there is not enough physical run to render a meaningful hallway segment.

### 4. Eliminate wall-edge conflicts

- Split target wall runs at the exact mouth boundaries.
- Make jambs and wall returns begin where those wall runs end, with no coplanar faces hidden inside one another.
- Keep doors, plaques, and child openings outside the reserved junction clearance; relocate them only to surviving wall runs.
- Keep hallway writing attached to a verified wall host. If no wall remains, do not render the plaque in free space.

### 5. Make collision resolution complete

- Resolve merges until the layout stabilizes, with a graph-size safety bound rather than a fixed three-pass assumption.
- Run a final footprint-overlap audit. In development, report any unresolved corridor overlap with both hallway IDs and coordinates.
- Ensure adding more doors can still extend a hallway, but the final extension clamps to the first encountered hallway and becomes exactly one junction.

### 6. Verify the repair in motion

- Add geometry tests proving that parent slabs are cut, arriving slabs stop at the throat, junction meshes own the removed footprint, and no two floor/ceiling triangles overlap.
- Test square, 60-degree, shallow-angle, endpoint, near-zero-run, and chained junction merges.
- Run the navigation tests and typecheck.
- Walk the same junctions again from all four directions and compare screenshots while moving slowly through every seam. Acceptance is zero flicker, flashing, black gaps, protruding walls, doors in the road, or floating labels.

## Scope guard

Do not change materials, textures, door artwork, lighting design, camera controls, Building Map styling, galleries, or the rest of the building. This is limited to junction segmentation, surface ownership, collision completion, and wall-hosted object placement.
