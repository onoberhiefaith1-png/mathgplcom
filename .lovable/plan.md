## Goal

Turn the Adventure scene into a single, continuous rotating building — the same way the homepage academy curves its images onto a cylinder so the panels visually connect and rotate as one. Add the new MATH GPL palace image, remove the spherical cloud structure, and make the whole building much larger (covering about two-thirds of the screen width).

## What I'll change

### 1. Add the new MATH GPL palace image
- Process the uploaded palace image: remove the bright green background (same chroma-key + edge-feather approach already used for the island images), keeping all the architecture intact.
- Upload it as a CDN asset (`adventure/mathgpl-palace.png`) and add it to the Adventure scene's image set.
- It becomes one of the panels in the rotating ring alongside Geometry, Algebra, Statistics, Calculus, and Trigonometry (six panels total).

### 2. Mesh the images into one connected building
- Replace the current flat floating `planeGeometry` panels with **curved cylinder segments**, exactly like the academy guide (`CylinderGeometry` with a per-panel `thetaStart`/arc).
- The six images wrap seamlessly around a single cylinder, so as it rotates they read as one identical, connected structure rather than separate stickers.
- Keep the gentle auto-rotation; tune the radius/height so the seams line up and the bases sit in the cloud line.

### 3. Remove the spherical cloud structure
- Delete the `CloudBasin` (the stacked ring/circle disks) and the extra glow disks that create the "spherical surface" look.
- Replace with an academy-style low cloud treatment: clouds sit at the building's base and rotate with it, so the cloud reads as part of the rotating building instead of a separate sphere underneath.
- Keep the full-screen cloud photo backdrop as-is.

### 4. Make it bigger (two-thirds of the screen)
- Increase the cylinder radius/height and/or pull the camera in so the building fills roughly two-thirds of the screen width, leaving small margins on the left and right edges.
- Re-center vertically so the enlarged building stays framed.

### 5. Keep navigation intact
- Preserve the `/adventure` route and the Back button.
- Leave room for future content to sit on top of the scene.

## Technical details

- File: `src/components/adventure/RotatingAdventureScene.tsx` — swap plane panels for cylinder-segment panels (mirroring `RotatingAcademyScene.tsx`), remove `CloudBasin`, add a base cloud floor that rotates with the building, bump scale, adjust camera `position`/`fov`.
- New asset: `src/assets/adventure/mathgpl-palace.png.asset.json` (green removed via Python PIL/numpy chroma key, then `lovable-assets create`).
- No changes to `Adventure.tsx` page wiring or routes beyond what's needed.

## Result

Clicking Adventure opens a large rotating cloud-world building: the six images (five islands + the new MATH GPL palace) curve together into one continuous, identical-looking structure that rotates as a single building, with clouds integrated at its base and no spherical disk underneath.
