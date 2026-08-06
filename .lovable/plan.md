# Video Adventure – Final Polish & Audio Integration

Video Adventure only. Static Adventure gameplay rules stay as they are, except where audio playback is explicitly added.

## 1. Loop-scoped UI (no early, late or leftover elements)

One shared rule decides what is on screen, used identically on the teacher dashboard and every student device:

- Outside a Learning Point: video only — no Progress Bar, no Timer, no Reward, no answering.
- Inside a Learning Point: Progress Bar, Timer (countdown), Reward, questions unlocked.
- The moment the point is completed or its time expires: bars and timer disappear immediately, the reward finishes its upward travel over the remaining loop time, then everything unmounts and the video continues.

To remove the flicker, element visibility keys off the synchronized challenge/loop identity rather than the raw playhead, so a point cannot flash on before its challenge opens or linger after it closes. Elements also fade out over ~200ms instead of popping.

## 2. Restart Game replays the story only

Restart Game resets the teacher timeline: video to 00:00, all loop states cleared, all challenge timers cleared, every student device follows back to the start. Student marks, answered questions and earned rewards are untouched — nothing in the restart path writes to student progress or gallery rows, and this is guaranteed with an explicit check. The button is relabelled with a short confirmation ("Replay from the beginning? Student marks are kept.").

## 3. Countdown timer

Kept as-is: default 10 minutes per Learning Point, starts full at 10:00, counts down to 00:00, teacher-adjustable live.

## 4. Narration playback

Narration is already authored and pinned to timestamps but never reaches the ear on real devices. Two fixes:

- Narration is driven by the Learning Point entering "active" (and by timestamp crossings inside it), so a clip assigned to a point always speaks when that point begins. Play Once speaks once per point per run; Repeat speaks on every loop lap.
- Browser audio policy blocks sound that starts without a user gesture. The student screen gets a one-tap "Tap for sound" prompt on entry (and the teacher's Start Game counts as the gesture), which unlocks and primes the audio channel for the whole session.

## 5. Adventure sound system (teacher-uploaded)

No sounds are generated. The editor gains a Sound Library alongside the Narration Library where the teacher uploads their own files and assigns them:

- Background ambience — one per adventure, loops for the whole game.
- Environmental music — optional, per Learning Point / scene, loops while that point is active.
- Sound effects — one-shot, triggered on defined events: Learning Point start, required mark reached, time expired, reward awarded.

Playback works in both Static Adventure and Video Adventure.

## 6. Global MATHGPL background soundtrack

There is currently no global soundtrack setting in the platform, so it is built as part of this work:

- Settings gains a Background Sound section: upload or pick a track, on/off, volume.
- The track plays across the platform outside games, persists across page navigation, and is remembered per account.
- Entering an Adventure or Video Adventure fades it out; leaving or finishing the game fades it back in.

## 7. Audio priority

A single audio controller owns every channel so exactly one background track can ever play:

- Outside a game: global MATHGPL track.
- Inside Static Adventure: adventure ambience/music + effects.
- Inside Video Adventure: adventure ambience/music + narration + effects.

Narration temporarily ducks the background music while speaking. All entries and exits use short fades (~400ms).

## 8. Polish pass

A full run-through of the teacher dashboard and a student device together, checking: UI appears only inside its own point, transitions are seamless, no flicker, no leftover bars or reward panels, timers start and stop correctly, narration lands on the right point, and sound fades naturally on entering and leaving a game.

## Technical notes

- `src/lib/games/loopRuntime.ts` + `src/hooks/useVideoAdventureRun.ts`: single `loopUiPhase` derivation (`before | active | exiting | after`) consumed by `AdventureDashboardPage.tsx` and `src/pages/student/GamePlayPage.tsx`; element filtering moves off playhead comparisons onto challenge identity.
- Restart: `startGame` keeps deleting `video_adventure_challenges` rows and resets the run row only; no writes to `class_game_boards`, `game_progress`, gallery or award tables.
- New `src/lib/games/audio.ts` — an audio bus (channels: `global`, `ambience`, `music`, `narration`, `sfx`) with fade/duck helpers and a gesture-unlock latch; `useNarrationPlayback` routes through the `narration` channel.
- `GameCanvas` gains an additive optional `sounds` field (`ambience`, per-scene `music`, `effects` keyed by event) with uploads reusing the existing game-assets bucket path used by `uploadNarration`. Existing games load unchanged.
- Global track stored on `profiles` (additive column) plus a provider mounted in `src/routes/__root.tsx`; suppressed while any adventure route is active.
