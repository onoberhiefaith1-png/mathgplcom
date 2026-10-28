## Technical details
- Move sounds: extend the existing Web Audio synth (`src/lib/slate/audio.ts` pattern) with an Imagine-only cue set in `src/lib/imagine/moveSounds.ts`; fire-and-forget, ~40ms throttle for typing, shared mute/volume. No audio files.
- Margin: one absolutely positioned line over the surface column in `ImagineStage`, reusing `mobileMargin.ts` helpers; per-surface marks removed.
- Sensor navigation: click/arrow handlers set the active line index (>=1) only.
- Vault/Bomb/Time-Life: logic in pure helpers with small tests (chain radius, conversion values); visuals CSS transform/opacity on the reward layer, capped queue.
- Original 3D Game untouched. No database change.

## Verification
- Phone and desktop browser run: drag margin, type, erase, mark lines, trigger rewards; confirm typing stays instant and sounds play/mute correctly.
