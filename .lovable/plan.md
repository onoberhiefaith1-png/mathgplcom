# Clean building edges and add master-image background removal

## Goal
Keep the uploaded classroom building at its original quality, remove the unwanted glow/fringe around the outer roof edge, and give both master images the same background-removal control already available on each individual image.

## Confirmed current behavior
- The exterior is built by copying an **Outer Building Image** into the eight outer positions and an **Inner Building Image** into the eight inner positions.
- Individual image cards already support **Replace Image** and **Re-cut background**.
- The two master-image cards only have **Choose/Change picture**. A shared checkbox can process a new upload, but there is no direct background-removal action for an already selected master image.
- The building renderer maps those cutouts onto overlapping curved sections. The requested defect is the roof-edge glow/fringe, not the large central structure or the surrounding scene effects.

## Changes

### 1. Remove the outer-building roof-edge fringe
- Add building-specific cutout edge cleanup after background removal so residual backdrop/glow pixels around the roof silhouette are removed without recolouring, regenerating, compressing, or softening the actual building.
- Preserve the source image dimensions and lossless PNG output.
- Ensure fully transparent edge pixels cannot bleed their old backdrop colour when the image is curved, scaled, or repeated in the 3D building.
- Apply this cleanup to outer master-image background removal and individual building-image re-cutting, so all eight duplicated outer sections use the same clean source.
- Do not change the building geometry, central structure, rotation, background scene, particles, lighting, or any interior data.

### 2. Add direct background removal to both master images
- Add a **Remove background** action to **Outer Building Image** and **Inner Building Image**.
- Enable it only after that master image has been selected.
- On click, process the currently selected master image, replace its preview immediately with the cleaned transparent PNG, and show a working/success/error state.
- Keep **Choose picture / Change picture** as the separate replace action.
- Continue to duplicate the cleaned outer image across the eight outer positions and the cleaned inner image across the eight inner positions only when **Continue** is pressed.
- Keep each of the sixteen resulting image cards independently replaceable and re-cuttable afterward.

### 3. Make the upload and re-cut paths consistent
- Retain the existing “remove background when choosing pictures” option for automatic processing during upload.
- Store enough source information for the direct master-image action to load and reprocess the selected image reliably.
- Use the same validated cutout pipeline for automatic master uploads, direct master re-cutting, and individual image re-cutting.
- Never apply duplicate copies until processing has succeeded; failures leave the current image untouched.

## Verification
- Load the supplied classroom image as the outer master and remove its background.
- Confirm the master preview has no roof-edge glow while the building itself retains its original sharpness, colour, signage, windows, and lighting.
- Apply it and confirm all eight outer positions use the clean image without new seams or halos during rotation.
- Repeat the action on the inner master and confirm its preview and eight inner positions update correctly.
- Confirm replacing and re-cutting individual images still works.
- Confirm no exterior geometry, central structure, scene effects, building settings, or interior content changed.
- Run the focused building tests, type check, and a signed-in visual check of the editor and rotating building.

## Out of scope
- Removing the central tower/spiral.
- Removing scene sparkles or changing scene lighting.
- Redesigning the building editor or the building geometry.
