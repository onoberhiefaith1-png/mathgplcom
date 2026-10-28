# Fix Replace Building: cutout blending, restore MathGPL building, and building-only asset picking

## Goal
Make the Replace Building page behave as two clear building modes:

1. **MathGPL building** — the permanent original rotating building, with editable pictures/video slots.
2. **Custom building** — one uploaded or selected image/video used as the whole building.

The user must be able to remove the background from a custom building so it blends into the homepage, save it, change the background video independently, and later switch back to the permanent MathGPL building.

## Current findings from the code
- `HomepageReplaceBuildingPage.tsx` already has `Restore MathGPL building`, but the preview stays on the old custom asset because local draft state is not cleared after restore.
- The page opens `AssetLibraryModal` with `kind="reward"`, so “Choose building from Asset Library” defaults to reward assets. That explains why non-building pictures can appear when trying to choose a building.
- Image background removal exists, but the saved homepage renderer (`RotatingAdventureScene.tsx` / `CustomBuilding`) does not use the same blend/chroma rendering path as the editor for custom buildings.
- Video background removal/chroma controls exist in `SettingsPanel`, but the live homepage custom-building renderer currently always uses plain `SignedMedia`, so video cutout settings are not respected after saving.
- The background layer is stored separately from the building layer in `homepageConfig.ts`, so changing the background to a video should not overwrite either the MathGPL building or the custom building.

## Plan

### 1. Make Restore MathGPL building visibly switch back immediately
- Update the restore action so it persists `buildingMode: "mathgpl"` and clears the local custom-building draft in the editor.
- Keep `customBuilding` stored unless removing it is necessary; the important behavior is that `buildingMode` controls what is shown.
- Make the header/button wording clear that it switches back to the permanent MathGPL building for the selected version, including Free.

### 2. Make removed backgrounds blend on the real homepage
- Reuse the same visual rules from the editor when a custom building is rendered on the homepage:
  - transparent image assets render without a black/solid wrapper,
  - blend mode is respected,
  - video chroma removal is respected,
  - opacity/position/scale/rotation remain unchanged.
- When image background removal finishes, set safe defaults that help the cutout blend naturally with the scene, while leaving the user free to edit blend/opacity afterward.
- Keep background-video changes independent: saving a background video must not switch the building mode or delete the MathGPL/custom building state.

### 3. Fix “Choose building from Asset Library” so it only chooses buildings
- Replace the generic reward/default asset picker behavior for this page with a building-specific picker.
- The picker should prioritize actual building assets:
  - saved building snapshots from the Buildings shelf,
  - structure/building art from the MathGPL asset library,
  - user-uploaded building images/videos.
- Hide or block unrelated reward/effect/background categories from this specific “Choose building” flow so selecting a random picture cannot silently become the building.

### 4. Support applying saved building snapshots to Free and Pro correctly
- If the user is editing `/homepage/replace-building/free`, applying/restoring should target the Free building only.
- If the user is editing `/homepage/replace-building`, applying/restoring should target the user’s own MathGPL/Pro building only.
- After applying a saved building snapshot, refresh the editor state so the preview matches what was actually saved.

### 5. Verify behavior manually in the preview
- On `/homepage/replace-building/free`:
  - remove background from the current building image,
  - save and verify the live homepage blends the cutout over the current screen/background,
  - change the background to a video and verify the building remains independent,
  - restore the MathGPL building and verify the permanent Free building returns,
  - open “Choose building from Asset Library” and verify only building-appropriate choices are available.
- Also verify the Pro replace-building page still works independently.

## Technical details
- Likely files to change after approval:
  - `src/pages/homepage/HomepageReplaceBuildingPage.tsx`
  - `src/components/adventure/RotatingAdventureScene.tsx`
  - `src/components/gamebuilder/AssetLibraryModal.tsx` or a new building-specific picker component
  - possibly `src/components/gamebuilder/BuildingsShelf.tsx` / `src/lib/homepage/buildingAssets.ts` if snapshot application needs a pick-only mode
- Do not change the general game asset picker globally unless needed; this fix should be scoped to Replace Building.
- Do not merge the background and building layers; they must remain independent.
