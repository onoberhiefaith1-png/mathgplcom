# Fix the dark patch seen through a merge junction

## What you are seeing

In the circled region you are looking through the cut mouth of the merge junction at the **outside** of the hallway you are about to enter — not at its wallpaper. Once you step through, you are inside that hallway and the wallpaper appears normally.

Confirmed in the code:

- Every wall, floor and ceiling surface is drawn with `side={THREE.DoubleSide}` (`SurfacePlane`, `PlanTriangle`, and the merge/branch reveal meshes in `HallwayScene.tsx`). So a corridor's outer skin is drawn as well as its inner face.
- Corridor lighting is a row of `pointLight`s placed on the corridor centreline **inside** the shell. Nothing lights the outer skin, so those exterior faces render almost black — the dark wedge in the screenshot.
- At a merge junction the mouth is cut in the wall you are standing behind, but the space between that wall plane and the arriving corridor's shell is not enclosed with interior surfaces on all sides, so the exterior skin is what the mouth frames.

So this is not a wallpaper/texture-loading problem: the texture is loaded and correct, you are simply seeing the back of the panel.

## The fix

### 1. A corridor is only ever seen from the inside
- Draw hallway walls, floor and ceiling with inward-facing single-sided materials instead of `DoubleSide`, so the outer skin of a corridor is never rendered at all. Looking through a junction mouth then shows the far corridor's *interior* wallpaper, ceiling and floor — never a black plane.
- Apply the same to the artwork overlay mesh that carries the imported wallpaper image, so the visible interior face keeps the exact imported design.
- Keep jamb blocks, lintels and returns solid (they are real thickness and must read from both sides), but bound them to the mouth cut as they already are.

### 2. Enclose the junction throat with interior surfaces
- Where a hallway merges into another, finish the throat between the cut wall plane and the arriving corridor's shell with interior floor, ceiling and side returns, all using the same wallpaper/floor/ceiling settings as the hallway that owns the throat, so the surface reads continuously through the opening.
- Single-owner geometry stays as it is: no new overlapping slab, no depth bias — the throat pieces butt at the existing cut boundaries.

### 3. Light what the mouth frames
- The mouth of a connected hallway gets its own throat light so the first metres beyond the opening are lit at the same level as the corridor you are in. Currently a connected hallway is lit only along its own centreline, which starts past the throat.
- No change to the global lighting design, fog, brightness or materials — one light per visible junction mouth.

## Verification

- Walk to each merge junction and screenshot from four positions: approaching, at the threshold, standing inside looking back, and from the other hallway. Acceptance: the wallpaper, floor and ceiling read continuously through the mouth with no black wedge and no flicker.
- Run the building navigation tests and the typecheck.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx`: `SurfacePlane` and `PlanTriangle` take an explicit facing (inward) instead of hardcoded `DoubleSide`; wall/deck calls pass the inward normal for their side; merge/branch throat gains interior floor/ceiling/return surfaces sourced from the owning hallway's environment; add a mouth light per visible junction opening.
- `src/lib/building/navigation.ts`: expose the throat footprint already derived for the cut so the throat surfaces and the wall cut share exactly the same coordinates.
- No changes to materials, textures, gallery assets, doors, camera, Building Map, editor, or the rest of the building.
