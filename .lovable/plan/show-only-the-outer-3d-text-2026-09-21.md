# Show only the outer 3D text

## Goal
Fix only the duplicate text visible in **3D Text** mode. **Surface Text** remains unchanged.

## Confirmed cause
The display selector already mounts only the chosen Surface or 3D implementation. The remaining duplicate is inside the 3D renderer itself: it draws a readable inner/base text layer and then draws the raised outer 3D geometry over it. Tile-style 3D text follows the same base-text-plus-physical-object pattern.

## Changes
1. Keep the internal 3D text pass mounted for wrapping, caret placement, measurement, and shared question/test state, but make every part of that pass visually invisible and non-interactive.
2. Leave only the raised outer 3D letters or tiles visible when **3D Text** is selected.
3. Preserve the current one-selector architecture: switching to **Surface Text** hides the complete 3D visual layer, while switching to **3D Text** hides the Surface Text visual layer.
4. Do not delete either renderer or alter question state, typing, line mapping, surface growth, teacher text settings, marking, rewards, Slate Artisan, or saved stage design.

## Verification
- Add focused checks proving the internal measurement pass remains present but cannot display colour, outline, shadow, selection, caret, or pointer targets.
- Verify dimensional and tile-style 3D modes each show one visible text treatment only.
- Verify Surface Text still looks and behaves exactly as it does now.
- Test the current saved Game in Edit and Play, including rapid line entry and switching between Surface Text and 3D Text.
