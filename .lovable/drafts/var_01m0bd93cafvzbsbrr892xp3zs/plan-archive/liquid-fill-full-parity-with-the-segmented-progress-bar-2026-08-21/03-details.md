## Editor behaviour

Opening Edit Item on either type shows the same sections in the same order and positions. Only the type-specific parts differ:

- Liquid Fill: Fill style (Plain colour / Energy), liquid colour, energy picker, energy particle size and density. Slot count and per-slot energy are hidden, since a liquid vessel has no slots.
- Segmented: unchanged, including slot count and per-slot overrides.

Every control updates the stage preview immediately — colour, style, fill style, energy, size, transform, slant — with no save-and-reopen.

## Technical notes

- `src/lib/games/types.ts`: add `liquidColor?: string` and `energyDensity?: number` to `ProgressConfig`. `progressFill` and all scoring stay untouched; both renderers keep calling it.
- `src/components/assets/QuestionProgressContainer.tsx`: accept optional `fillColor`, `frameSrc`, and an `energy` descriptor (path, media type, source, scale, density). Derive the liquid gradient from `fillColor` when given (light/base/deep tints of the one hex) instead of the theme palette. When `energy` is set, render a deterministic scatter of the effect inside the existing `chamber-<id>` clip path, restricted to the region below the surface, with per-particle drift/shimmer driven by the existing rAF clock; particle count = round(area × density), capped for performance.
- `src/components/gamebuilder/SettingsPanel.tsx`: move the Fill style and Energy sections out of the `barType === "segmented"` guard. Inside them, hide slot-only rows (per-slot energy, slot count) for liquid; add a density slider for liquid; add "Use my uploaded frame" to the liquid style grid.
- `src/components/gamebuilder/CanvasElementView.tsx`: pass the config's colour, fill style, energy asset, scale and density into the liquid renderer, and the element's own uploaded media as the frame when no liquid style is selected.
- No database or migration change; the new fields ride inside the existing canvas JSON, and older bars read as plain colour with the style palette.

## Verification

Segmented first: confirm presets, slot count, per-slot energy, glow and marks behave exactly as before. Then Liquid: set marks to pass 400 and step marks — the plate reads 0/400, 25/400, 200/400, 400/400 while the level rises to empty, quarter, half, full. Change the fill colour and watch the liquid recolour instantly. Switch to Energy, pick an effect, and confirm the particles fill only the liquid region, stay inside the vessel, and grow denser as the level rises while the frame stays still. Move, scale, rotate and slant the bar and confirm liquid and particles travel with it. Reload the adventure and confirm every setting persisted.
