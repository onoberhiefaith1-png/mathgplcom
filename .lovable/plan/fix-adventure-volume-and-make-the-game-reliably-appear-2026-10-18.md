# Fix Adventure volume and make the Game reliably appear

## What goes wrong today
- On iPhone/iPad the browser ignores the "volume" setting on sound files, so dragging the slider to 0 changes nothing. Only "mute" is obeyed there. Every sound in the Academia Adventure (music, narrator, Game music, reward sounds) relies on volume alone.
- The student's master slider only reaches the music and narrator. Reward/Game sound effects and the video's own sound ignore it.
- The teacher's "Normal volume" in the Adventure sound window is not treated as the ceiling for the Game music when the Game's own music is used.
- The Game sometimes did not appear at a learning point; cause not yet confirmed.

## What will change
1. **One volume chain, highest level first**
   - Teacher's Adventure sound settings = the top (maximum) level.
   - Student's master slider scales everything below it, from 0 to that maximum.
   - Applies to: background music (uploaded or the Game's), narrator, reward/Game sound effects, and video sound.
2. **Volume 0 really means silent, on every device**
   - Sounds are routed through a single volume control that phones respect; at 0 (or the mute button) every sound is also hard-muted.
   - Same fix in the teacher's sound window, so its sliders work on phones too.
3. **Game always appears at learning points**
   - Reproduce with your Session's Adventure data, find why the Game layer didn't show (e.g. Game or its questions not loaded when the loop is reached), and fix it.
   - If a Game truly can't load, show a clear message with Try again instead of a blank video.
4. **End-to-end scan**
   - Walk the whole flow: Session → Adventure → Start → narration/music → loop → Game → pass → video resumes → finish, checking for errors, and fix what fails.

## Unchanged
Standalone Adventure, normal Game, Smartboard.

## Technical details
- Add a shared Web Audio gain bus in `src/lib/games/audio.ts` (media elements via `createMediaElementSource` → master GainNode), plus `el.muted = gain === 0` fallback; expose `setMasterGain`.
- `src/lib/slate/gameSound.ts`: background and reward-effect elements join the bus; reward volume multiplied by master.
- `AcademiaAdventurePlayer.tsx`: master = teacher `musicVolume` ceiling × student slider; apply to custom music, Game bgSlot, narration channel, effects, video element; mute = hard mute.
- `AdventureAudioSettings.tsx`: preview audio uses the same bus.
- Diagnose Game-not-appearing via Playwright + data query on the Session activity (`ref_id`, `game_id`, point questions, `allBoards`), then fix the gating at the `active && game && boards.length > 0` condition.
- Add tests for volume chain (0 → silent, ceiling respected) in `adventureMix` tests.
