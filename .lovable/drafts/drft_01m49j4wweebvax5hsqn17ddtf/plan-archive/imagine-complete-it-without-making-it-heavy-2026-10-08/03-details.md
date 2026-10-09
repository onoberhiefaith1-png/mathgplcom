## 6. Full comparison with the original Game
Before building, I'll write out every original-Game feature (features and how students interact with them) and sort each into:
- **Missing & light → add** (e.g. surface styles, text colour, per-reward activation, line notes, sounds per reward)
- **Missing & heavy → leave out** (3D rooms, camera track, extruded 3D text, lighting/physics, 3D models)
- **Already present** (marking, timer, lives, Vaults, levels, guest play)

That list is shown to you at the end alongside what was added.

## 7. Speed test
After building, measure first tap, line switching and several rewards firing at once on phone and laptop sizes, and compare with the current Imagine. Anything that slows it down is cut back.

## Technical details
- Bracket fix: trace `slot.text` hidden-pattern markers through `MathLine` (`gameslate/ReadableMath`) vs the original Game's text restore (`lib/slate/restoreText`, `structuredMath`); render via the shared lesson-note normaliser. Add tests for `5x^2`, `\sqrt{b^2-4ac}`.
- Layout: `ImagineStage` container `w-[90vw] mx-[5vw]`, card height auto from content with a small minimum.
- Surfaces: reuse `lib/slate/surfaces` textures/ink as CSS backgrounds only.
- Text colour stored in existing game text settings; no schema change.
- Rewards: staged CSS keyframes (transform/opacity only) per reward kind in `RewardOverlay`, capped queue, reduced-motion shortcut. Original 3D Game untouched; no three.js imports.
