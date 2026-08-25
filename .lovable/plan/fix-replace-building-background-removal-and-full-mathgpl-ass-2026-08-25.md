# Fix Replace Building: background removal and full MathGPL Assets picker

## Goal
Make Replace Building behave the way the rest of the system works:
- **Remove background** must actually cut out the selected building image immediately in the editor preview, so it blends into the scene before saving.
- **Choose building from Asset Library** must open the full MathGPL/myGPL asset workspace, not a restricted building-only picker.
- Any asset the user chooses can become the replacement building, regardless of category.

## Current state confirmed
- The Replace Building page currently uses a custom `BuildingLibraryModal` with only **Saved buildings** and **Building art** tabs.
- The existing general `AssetLibraryModal` already has a full MathGPL asset browser path and an upload/assets panel path.
- The Remove background button currently runs an image-only background-removal flow, then uploads the cutout and replaces the preview asset, but the user-visible behavior is not reliable enough: the button can appear inactive or the result does not visibly blend immediately.

## Changes to make

### 1. Restore the full MathGPL asset picker
- Stop using the restricted `BuildingLibraryModal` on Replace Building.
- Reconnect Replace Building to the general asset picker used elsewhere.
- Make the picker start at the full MathGPL asset workspace instead of forcing a single category.
- Keep the user able to browse across all categories and subcategories.
- Keep uploaded user assets available, not just built-in structure pictures.
- Rename the button/dialog wording to match the product language, for example **Choose from MathGPL Assets**.

### 2. Allow any chosen asset to become the building
- When the user picks any image/video asset, convert it into the custom replacement building preview.
- Preserve the existing transform controls: position, scale, opacity, rotation, blend, chroma/video settings.
- Do not reject non-building categories; only reject files that cannot be placed as media.
- Keep emoji-specific behavior unchanged elsewhere; this change applies only to Replace Building.

### 3. Fix Remove background so it visibly works
- Make the button active whenever a selected replacement image exists.
- If there is no image selected, show a clear disabled state or message.
- When clicked:
  1. Fetch/load the selected image.
  2. Run background removal.
  3. Replace the editor preview immediately with the transparent cutout.
  4. Keep the current size, position, opacity, rotation, and layer settings.
  5. Show success only after the preview asset has been replaced.
- Add a fallback message if the selected asset cannot be loaded or cannot be processed.

### 4. Preserve the two-building model
- **MathGPL building** remains the permanent default building users can switch back to.
- **Custom replacement building** remains a separate saved image/video layer.
- Changing the background image/video must not overwrite either building mode.
- Switching back to MathGPL should immediately clear the custom preview from the editor.

### 5. Verification
- Open `/homepage/replace-building/free` signed in.
- Confirm the picker opens the full MathGPL asset workspace, not only building art.
- Pick an asset from a non-building category and confirm it appears as the replacement building.
- Click **Remove background** on an image and confirm the visible preview changes to a transparent/blended cutout.
- Save, return to the homepage, and confirm the cutout blends with the screen/background.
- Switch back to MathGPL building and confirm it returns immediately.
- Run TypeScript compile check.

## Out of scope
- Do not change the emoji picker behavior.
- Do not change global asset-storage rules.
- Do not redesign the Replace Building page beyond the picker/removal behavior.
- Do not merge background media and building media into one setting.
