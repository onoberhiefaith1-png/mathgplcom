# Background: Live Preview + Faithful Appearance

Two fixes only — wall/background editing. Navigation, hallways, doors and the map are untouched.

## 1. Every background edit shows immediately, where you stand

The Edit panel already sends a draft environment into the live world, so the wiring exists; what needs proving and fixing is why the viewport keeps the previous image until you walk somewhere else. First step is to reproduce it in the browser and confirm which link in the chain is stale (draft state, signed-URL resolution, or the cached 3D texture object) rather than guessing. Diagnosis is unconfirmed until then.

Known weak points to address in the same pass:

- Textures are cached per image URL and the single shared texture object is then re-configured (zoom, position, tiling) by whichever surface renders last. When the left wall, right wall and terminal wall show the same image, they fight over one object, so a change can land on the wrong surface or appear not to land at all. Each surface gets its own copy of the image.
- When a newly chosen or uploaded image has no display URL resolved yet, the surface keeps showing the old image instead of switching the moment the URL arrives.
- Position, zoom, tiling, fit, colour and brightness changes must re-apply to the material on the spot, without waiting for a re-render caused by movement.

Result: choose a template, replace an image, drag position, change zoom or any other background setting — the wall in front of you updates as you do it, from a standing position, with no walking, reloading or door opening.

## 2. The imported image looks like the imported image

Right now a textured wall is lit like painted plaster: scene lights are deliberately dim, tone mapping compresses it further, and the surface colour is still washed over the image. A bright artwork therefore renders dark.

Changes:

- A surface that has an image is treated as artwork, not as a lit material: the image drives its own visible brightness so corridor lighting can no longer crush it. Untextured surfaces keep their current lit look, so the corridor still reads as a 3D space.
- No colour wash over an image — the image's own colours, contrast and saturation come through. The surface colour only applies when there is no image.
- The image is rendered outside tone-mapping compression, so bright areas stay bright.
- The appearance no longer depends on where you are standing or which hallway you entered: the same wall image looks the same everywhere.

Editing control:

- Each surface gains a **Brightness** setting (default 1 = exactly as imported) for small adjustments in either direction. Saved with the surface, applied live.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx` — `loadTexture`/`useLoadedTexture` return a per-surface clone of the cached image so fit/offset/repeat are independent; `Surface` re-applies placement and flags the material on every relevant change; textured surfaces render with an unlit-faithful material path (`toneMapped={false}`, image at full value, no tint) while preset/colour surfaces keep `meshStandardMaterial`.
- `src/lib/building/types.ts` — add `brightness: number` to `SurfaceDesign` (default 1) in `DEFAULT_ENVIRONMENT`.
- `src/lib/building/env.ts` — merge the new field so existing saved buildings default to 1 (no visual change for them beyond the faithful-rendering fix).
- `src/components/academy/editor/BuildingSettingsPanel.tsx` — Brightness slider per surface, pushed through the existing `onPreviewChange` draft path.
- `src/pages/academy/AcademyEditorPage.tsx` — ensure a newly chosen/uploaded texture path resolves its URL immediately and the preview environment is what the scene renders (already the case; verify no stale branch).
- Environment is stored in the existing `buildings.environment` JSON — no migration needed.
- Tests: extend `src/lib/__tests__/buildingEnv.test.ts` for the new field's merge/default behaviour.

## Verification

1. Stand in a hallway in the editor, change the left wall template — the wall changes instantly, without moving.
2. Replace the image, then drag position and change zoom — each adjustment is visible while adjusting.
3. Compare the rendered wall with the source file: brightness, colour and contrast match closely at default brightness 1.
4. Walk through the building and back — the same wall stays the same image and the same brightness.
5. Confirm navigation, junctions, doors and map behaviour are unchanged.
