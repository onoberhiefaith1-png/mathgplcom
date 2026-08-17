# Open Faces That Read as Real Cavities

Make an opened 3D solid unmistakably open from a normal viewing distance, using geometry, depth, shading and contrast derived from whatever colour the solid happens to be. Face opening, closing, selection, rotation, zoom, labels and every other interaction stay exactly as they are.

## Current state (verified)

- `Scene3DCanvas.tsx` already switches to a hollow shell (`ShellSurfaces`, lines 45-84) when any face is open: one mesh per real mathematical face, with open faces simply not drawn. The geometry side of the feature is correct and stays untouched.
- Each shell face uses a **single** `meshStandardMaterial` with `side={THREE.DoubleSide}` and the solid's own colour — so the inside of the far wall renders in the *same* colour as the outside. That is the main reason the opening disappears at a distance.
- Edges are built once from the closed `EdgesGeometry` (line 110), so the boundary of a removed face gets no extra emphasis.
- Lighting is deliberately flat: `ambientLight` 1.1 / 0.8, a camera-following `pointLight` at intensity 12, and two directionals. The camera light lights the cavity as brightly as the exterior, cancelling the depth cue.
- Colours come from `solid.style.color` (default `#7dd3fc`), so a single derivation step can serve every colour.

## 1. Colour-derived material system

New helper `src/lib/geometry3d/cavityShading.ts` takes the solid's base colour plus the workspace theme (light/dark) and returns a small palette computed in HSL:

- `exterior` — the base colour, unchanged (current look preserved).
- `interior` — same hue, reduced lightness and slightly raised saturation, with the drop scaled so pale colours darken more and already-dark colours darken enough to still separate from the background.
- `interiorDeep` — a further-darkened variant for surfaces far from the opening.
- `rim` — a high-contrast boundary tone derived from the base colour (dark on light solids, light on very dark solids).
- Guard: if the resulting interior would sit too close to the workspace background value, the derivation pushes it further apart, so the cavity never vanishes into a matching background in either theme.

No colour literals per hue; blue, green, purple, orange, red and grey all flow through the same function.

## 2. Two-sided face rendering

Each shell face is drawn as two meshes sharing one geometry instead of one `DoubleSide` mesh:

- Front side: the exterior material as today (flat shading, same roughness/metalness).
- Back side: `side={THREE.BackSide}` using the derived interior colour, darker, with a small emissive-free matte finish.

Result: looking through the opening you see genuine interior walls, clearly darker than the exterior, with correct shading from their own orientation.

## 3. Depth gradient inside the cavity

Interior brightness is graded by distance from the opening rather than one flat dark tone:

- Compute the centroid and plane of the open face(s).
- Give each interior mesh a per-vertex colour ramp (`vertexColors`) between `interior` near the opening plane and `interiorDeep` at the deepest point of the solid.
- With several faces open, the ramp uses distance to the nearest opening, so multi-face openings stay coherent.

This produces the lighter-at-the-mouth → darkest-at-the-back reading the brief asks for, and it rotates correctly because the ramp lives in the solid's own local space.

## 4. Opening rim and silhouette

- Shell mode gets its own edge pass: edges rebuilt from the faces actually drawn, so the silhouette stays crisp and the boundary of a removed face becomes a real outline instead of an inherited closed-solid edge.
- Boundary edges of an opening render slightly thicker/stronger than ordinary exterior edges, using the derived `rim` tone — a defined lip, not a cartoon outline.
- Rim weight has a minimum so it stays perceptible when the object is small on screen, without thickening at close range.

## 5. Cavity shadow and lighting balance

- A soft occlusion gradient darkens the interior walls where they meet the rim, giving the "physical cavity" cue without shadow maps.
- The camera-following light is attenuated while a solid is hollow so the exterior stays brighter than the interior; ambient stays high enough that interior walls remain legible rather than black.
- Exterior appearance at other times is unchanged.

## 6. Verification

Checked in the 3D workspace with headless screenshots at close, working and far zoom:

- Cube, cuboid, prism, pyramid and the existing polygonal solid.
- One face open and several faces open, before and after rotation.
- Base colour cycled through blue, green, purple, orange, red and grey.
- Light and dark workspace backgrounds.

Pass condition: at far zoom the opening is still immediately readable in every colour and both themes, with no per-colour special-casing.

## Technical notes

- Files: new `src/lib/geometry3d/cavityShading.ts`; `Scene3DCanvas.tsx` (`ShellSurfaces` split into exterior/interior passes, shell edge pass, hollow-aware light intensity). `openFaces.ts`, `topology.ts`, `geometryFactory.ts` and all interaction code stay as they are.
- `polygonFaceGeometry` output is reused for both passes — no duplicated geometry objects beyond the second material, and disposal keeps following the existing cleanup effect.
- No transparency-only solution, no glow, arrows, badges or labels.
- No database or schema changes.
