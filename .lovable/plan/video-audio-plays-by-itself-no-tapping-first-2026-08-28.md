# Video audio plays by itself — no tapping first

The teaching video already plays automatically, but it starts silent and only speaks after the screen is tapped. Sound must be on from the first frame: the Introduction talks as soon as it starts, and every move from one line/number to the next plays that segment with its audio.

## What changes

1. **Audio is on by default.** The player never chooses "muted" as a normal state. Volume comes back from the saved session setting; mute is only ever on if the teacher/student actually pressed the mute button.

2. **The silent-fallback no longer sticks.** Today, when the browser refuses sound-on autoplay, the player mutes itself *and saves that choice*, so every later question and every later lesson opens silent. The involuntary mute is now temporary and never saved.

3. **The gesture that unlocks sound is collected up-front, not after the failure.** The board listens for the first interaction anywhere in the app from the moment it mounts (opening the board, pressing Present, clicking a floating chip — all count), and shares one platform-wide "sound is allowed" latch with the existing audio system. In almost every real use the student has already clicked something before a video exists, so the very first clip plays with sound.

4. **If a browser still blocks the first clip, it self-heals silently.** The clip keeps teaching without sound, and the moment any interaction happens the player unmutes in place and continues — no prompt to dismiss, and it never has to happen twice in a session.

5. **Every segment jump re-asserts sound.** Introduction start, each line-to-line move, and the Conclusion all set the element unmuted (unless deliberately muted) before playing, so a single blocked clip cannot leave the rest of the lesson silent.

6. **A small "Sound is off — tap to enable" hint** appears only in the rare blocked case, and disappears on its own once sound starts.

## Technical notes

- `src/components/smartboard/QuestionVideoPane.tsx`: split state into `muted` (user intent, persisted) and `forcedMute` (temporary autoplay fallback, never persisted); the persistence effect writes only user intent. `goTo` sets `el.muted = muted` and clears `forcedMute` on success.
- Replace the `needsSound`-only listener with an always-mounted first-gesture listener (`pointerdown`, `keydown`, `touchstart`) that calls `unlockAudio()` from `src/lib/games/audio.ts` and, if a clip is currently force-muted, unmutes and resumes it.
- Read `audioUnlocked()` before the first play attempt so an already-unlocked session goes straight to sound-on playback.
- No changes to line mapping, ranges, Introduction/Conclusion semantics, or the strict one-to-one line law.
