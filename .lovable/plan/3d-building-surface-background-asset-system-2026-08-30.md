# 3D Building Surface & Background Asset System

## Goal

Upgrade the visual surfaces of the existing 3D building into a proper "surface design system": four independent editable surfaces (Left Wall, Right Wall, Floor, Roof/Ceiling), each with its own design; uploaded images fitted like a physical plasterboard panel (cover/crop, never stretched or distorted); a built-in sample background gallery (8 styles); an upload flow with preview and adjustment (Zoom / Move / Reset / Fit / Apply / Remove); per-building persistence; duplication that copies the visual configuration into an independent copy; and texture performance safeguards.

The building, hallway, movement, doors, products, editing/view modes and workspace system are NOT rebuilt — only the surface rendering and its editing UI improve.

## Current state (verified)

- The data model already has four independent surfaces: `EnvironmentSettings.leftWall / rightWall / floor / roof`, each a `SurfaceDesign { preset, color, texture(path), scale, offsetX, offsetY, repeat }`, stored per-building in `buildings.environment` (JSONB) with RLS scoping. Left/right walls are already separate.
- `BuildingSettingsPanel` already renders per-surface editors: preset chips, colour picker, upload/remove texture, scale / offset X/Y / repeat sliders, with a live 3D preview and Save Changes persistence.
- Textures upload to the game-assets bucket (`uploadBuildingTexture`); the renderer receives signed URLs via `resolveEnvironmentTextures` and `HallwayScene.Surface` maps them onto the corridor geometry (floor/roof/left/right wall per segment).
- Duplicate building already copies the whole environment (visual configuration) plus the walkway graph; the copy is independent.
- Gap: when a texture is used with `repeat=false`, `Surface` maps it 1:1 onto the plane, which stretches/distorts images whose aspect differs from the wall. There is no cover/crop fit, no zoom/pan semantics beyond raw UV offsets, no sample gallery, and no upload preview/adjust flow (upload applies immediately).
- Gap: the corridor reads too dark in walk mode (visibility floor) — surface presentation work should fix this while making textures look "installed", not pasted.
- No schema change is needed: `environment` is JSONB; a new `fit` field persists without a migration.

## Steps

### 1. Fit engine — cover/crop, no distortion (core)

- Add `fit: "cover" | "stretch"` to `SurfaceDesign` (default `"cover"`; `"stretch"` preserves today's behaviour).
- In `HallwayScene.Surface`, once the texture's image dimensions are known, compute UV repeat/offset so the image covers the plane while preserving aspect ratio (a `background-size: cover` equivalent in UV space), using the plane's dimensions, the texture's aspect, `scale` as zoom and `offsetX/offsetY` as pan (focal position). Apply via `useEffect`, never during render.
- The result: a portrait image on a wide wall is cropped top/bottom (or sides) with the important centre kept; nothing is squeezed.

### 2. Built-in sample background gallery

- Generate 8 professional sample backgrounds (square JPGs, bundled as app assets): Modern Academy, Mathematics, Premium Dark, Bright Classroom, Science, Minimal, Futuristic, School Branding (clean surface with a logo zone).
- Introduce a `builtin:<key>` texture path convention: `resolveEnvironmentTextures` returns the bundled asset URL directly for `builtin:` paths (no signed URL); storage paths keep the current flow. The renderer is unchanged.
- New "Choose Template" gallery dialog per surface: thumbnail grid of the 8 samples; picking one applies it to that surface only.

### 3. Teacher upload flow with preview + adjust

- New "Upload Image" flow per surface: pick a file -> client-side optimisation (resize long edge to max 2048 px, WebP/JPEG ~0.85, strip metadata) -> upload to the bucket -> show a 2D fitted preview of the surface with the image cover-fitted.
- Adjustment controls in the flow: Zoom (scale), Move Left/Right (offsetX), Move Up/Down (offsetY), Reset, Fit (re-auto-fit), Apply (sets the texture + fit on that surface; the live 3D preview updates immediately), Remove (clears the texture).
- Final persistence stays with the existing Save Changes button; the teacher never touches UVs or materials.
- On replace, delete the previous texture object from the bucket to avoid bloat.

### 4. Per-surface settings panel + visibility floor

- Rebuild each surface section: current design preview thumbnail, Choose Template, Upload Image, Adjust controls (when a texture is set), Remove. Keep the existing colour-design preset chips.
- Raise the corridor visibility floor so panels read as installed surfaces: add a hemisphere/rim light, raise the default ambient/floor/roof brightness, and lighten the default floor/roof colours. This fixes the dark walk-mode view that made earlier testing hard.

### 5. Persistence & duplication

- Verify per-building save/load of surface designs (existing `updateEnvironment` + JSONB; nothing global).
- Verify duplication: the copy inherits wall/floor/roof designs, uploaded textures, positioning and door/environment settings, and that changing the copy's surfaces never changes the original (it writes its own `environment`; texture paths are immutable shared objects until replaced).

### 6. Performance

- Client-side resize keeps uploaded textures small; bundled samples are CDN-served and loaded on demand.
- Add a module-level texture cache in `HallwayScene` keyed by URL so the same sample applied to several segments/surfaces loads once (today each `Surface` loads its own copy).
- Enable anisotropy and keep mipmaps; no repeated large images in memory.

### 7. Verification

- Build/typecheck clean.
- Authenticated browser E2E: apply a sample to the left wall, upload a portrait image to the right wall (confirm no distortion — cropped, not squeezed), template the floor, upload a roof design; reload and confirm persistence; duplicate the building and confirm the copy keeps all four surface designs and that edits to the copy don't touch the original; view as a student and confirm textures render with lighting/perspective (not flat); confirm the corridor is clearly visible in walk mode; no page/console errors.

## Technical details

- `SurfaceDesign` gains `fit: "cover" | "stretch"` persisted in `buildings.environment` JSONB — no migration, existing rows fall back to `"cover"` at render.
- Cover UV math (plane aspect `p`, image aspect `a`, zoom `z`, pan `px,py`): `rx = max(1, a/p)`, `ry = max(p/a, 1)`; `repeat = (rx*z, ry*z)`; `offset = (0.5 - 0.5*rx*z + px, 0.5 - 0.5*ry*z + py)`.
- New files: `src/lib/building/gallery.ts` (sample keys, thumbnails, `builtin:` URL map), `src/lib/building/imageFit.ts` (cover math + `optimizeImageForTexture` canvas util), `SurfaceGalleryDialog.tsx`, `SurfaceUploadDialog.tsx` (under `src/components/academy/editor/`), 8 generated sample JPGs under `src/assets/surfaces/` (ES6 imports; Mathematics and Science at premium quality for crisp symbols, the rest standard).
- Edited: `src/lib/building/types.ts`, `src/lib/building/textures.ts` (builtin resolution), `src/lib/building/api.ts` (optimised upload + old-texture cleanup), `src/components/academy/world/HallwayScene.tsx` (fit engine, texture cache, hemisphere light, brighter defaults), `src/components/academy/editor/BuildingSettingsPanel.tsx` (surface sections + dialogs), `src/pages/academy/AcademyEditorPage.tsx` (wiring).
- Following this plan, the previously approved hallway interaction plan (click-to-enter zoom, `/academy/room/$roomId` page, live section counts, doorway hover, E2E) remains queued and will be implemented next.

## Out of scope

- Rebuilding the building, hallway geometry or movement/navigation.
- Door designs beyond the existing brightness/colour/texture controls.
- New lighting presets or environment effects beyond the visibility-floor fix.
- The hallway interaction items (already approved separately; queued after this plan).