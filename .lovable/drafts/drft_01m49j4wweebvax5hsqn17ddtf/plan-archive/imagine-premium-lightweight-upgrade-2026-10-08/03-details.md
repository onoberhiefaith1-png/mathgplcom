## Behaviour and quality rules
- Imagine remains DOM/CSS only; no Three.js, WebGL, physics, room, camera or 3D text imports.
- The writing surface measures its content and grows independently. Long mathematics wraps or scales within the surface rather than escaping it.
- The sensor follows the active line/caret state but never changes the mathematical source, marking, or Floating Numbers behaviour.
- Rewards run through a capped queue above the board with no pointer capture. Correct-line marking and line progression happen immediately, regardless of animation or audio.
- Use transform/opacity effects, short sound cues, reduced-motion support and an automatic shorter effect path on slower devices.
- Background music must not restart when writing, marking, changing lines or activating rewards.
- Existing Game records remain compatible. Missing new appearance choices receive lightweight defaults without changing the original 3D Game.

## Technical scope
- Extend Imagine’s own editor/settings controls and lightweight rendering modules; reuse existing Game data, surfaces, audio, rewards, assignments, grading and persistence.
- Keep all asset editing in the right-hand Imagine settings panel. The create flow exposes the same essential choices and previews them before saving.
- Use the project’s existing semantic styling and control components; avoid hardcoded presentation values where a token or saved surface value exists.
- Record the lightweight boundary in the existing Imagine architecture rule; no database change is expected.

## Verification
- Compare Create, Edit, Preview, teacher play, assigned student play, shared play and guest play for identical saved appearance and sound.
- Test surface growth with short text, long equations, fractions, roots and maximum text size across phone, tablet, laptop and classroom widths.
- Confirm the sensor tracks each active line and disappears or pauses appropriately outside active writing.
- Trigger several rewards while typing and changing lines; grading and input must remain immediate and the reward queue must stay bounded.
- Verify ball, calculator, Vault, life, timer and completion rewards each have a distinct lightweight activation and matching sound where configured.
- Confirm reduced-motion and sound-off modes, persistent music, visible line numbers, and no regression to the original Game.
