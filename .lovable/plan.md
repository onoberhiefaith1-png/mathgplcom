## Plan

Create a new Adventure scene that matches the homepage academy behavior more closely: the existing cloud background stays full-screen, and the five uploaded math islands (Geometry, Algebra, Statistics, Calculus, Trigonometry) are arranged in the same rotating 3D ring pattern. The first uploaded image will be treated only as reference and will not be used in the final scene.

## What I’ll build

1. Prepare the five subject images for use on the Adventure page.
   - Remove the green background from the five usable uploads.
   - Keep the artwork details intact.
   - Crop/feather the lower rocky edges so the islands can visually sink into the cloud layer instead of looking cut out.

2. Turn Adventure into a real rotating scene.
   - Replace the current static Adventure page with a scene modeled on the homepage rotating academy.
   - Position the cropped islands around a circular rotating structure using the same 3D ring behavior you chose.
   - Keep the cloud image as the full-screen backdrop.

3. Blend the islands into the cloud world.
   - Add a cloud/fog layer and depth treatment so the rocky undersides appear submerged into the background clouds.
   - Tune scale, spacing, and perspective so the ring feels cohesive rather than five flat stickers.

4. Keep navigation simple.
   - Preserve the Adventure route and back button.
   - Make the page ready for future content to be placed on top without breaking the scene.

## Technical details

- Reuse the existing React Three Fiber academy scene pattern already used on the homepage.
- Create a dedicated Adventure scene component instead of forcing everything into the page file.
- Use processed versions of the five uploaded subject images as textures/assets.
- Match the homepage rotation language, while adjusting geometry/materials so transparent cutouts and cloud blending render cleanly.
- Keep the first reference image out of the asset pipeline.

## Files likely involved

- `src/pages/Adventure.tsx`
- `src/App.tsx` (only if any route wiring needs cleanup)
- new Adventure scene/component file(s) under `src/components/academy/` or a nearby scene folder
- new processed image asset pointers for the five cropped subject artworks

## Result

Clicking Adventure will open a full-screen cloud world with a homepage-style rotating arrangement of the five math islands, with the green removed and the rocky bases visually disappearing into the clouds.