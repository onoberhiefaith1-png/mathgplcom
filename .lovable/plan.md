# Continuous teaching audio — never auto-silence between lines

## What is happening

The player is not losing browser permission at line 3. It is misreading a harmless interruption as a permission refusal.

Every line change pauses the video, seeks to that line's start, then plays again. When a new line arrives while the previous `play()` is still starting up, the browser rejects that `play()` with an "interrupted" error. The player treats **any** rejection as "the browser refused sound", so it mutes the video, shows "Sound is off — tap to enable", and stays silent for the rest of the exercise. Lines 1-2 usually survive because their transitions are slow enough for playback to settle first.

## The fix

- Only treat a genuine permission refusal (`NotAllowedError`) as blocked sound. Interruption/abort errors are ignored — playback continues with sound.
- Once sound has actually played once in the session, the system can never silence itself again: a later failure retries with sound on instead of muting.
- On every line jump, assert the student's own audio choice (`muted` intent only) and clear any earlier system silence.
- The "Sound is off — tap to enable" prompt only ever appears on the very first clip when the browser has genuinely not yet allowed audio, and it disappears permanently after the first gesture. It can never reappear mid-exercise.
- The student's mute button is unchanged and remembered: deliberately muted stays muted across every line until they unmute.

Nothing else about the player, the line mapping, the Introduction/Conclusion stages or the three-view layout changes.

## Technical notes

`src/components/smartboard/QuestionVideoPane.tsx` only:
- Add a `soundProvenRef` set true on the first successful sound-on `play()` (and on `audioUnlocked()`).
- Extract one `playWithSound(el)` helper used by `goTo`, `toggle` and the intro/conclusion paths: sets `forcedMute` false, `el.muted = mutedRef.current`, then `play().catch(err => ...)` where only `err.name === "NotAllowedError" && !soundProvenRef.current` sets `forcedMute`; every other error is ignored.
- Use `mutedRef.current` rather than the captured `muted` inside `goTo` so a stale closure can't reintroduce silence.
- Keep the existing global-gesture unlock effect; it also sets `soundProvenRef`.

## Verification

Run the exercise through lines 1 → 5 and the final line: audio is on at every transition, no "Sound is off" prompt appears, and pressing mute keeps it muted across lines until unmuted.
