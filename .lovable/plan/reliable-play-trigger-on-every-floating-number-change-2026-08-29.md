# Reliable PLAY trigger on every floating-number change

## Goal
Keep the existing working autoplay exactly as it is, and add one reliability layer on top so the video **always** starts playing when a new floating number (line section) becomes active — forward, backward, or revisited. No redesign, no new audio system.

## Root cause (diagnosed from `QuestionVideoPane.tsx`)
`goTo()` is the only place playback starts on a line change. It does:

1. `el.pause()`
2. `el.currentTime = target.start`
3. `playWithSound(el)` → a single `el.play()`

The failure cases where a floating number never plays:

- **Seek aborts the play.** Browsers reject `play()` with `AbortError` ("play() interrupted by pause()/load") when a seek lands between `pause()` and `play()`. The current catch retries only **once**, synchronously — still inside the seek-abort window — so it can fail too and the video stays paused forever.
- **Media not ready.** If the element is still seeking/buffering (`HAVE_METADATA` too low for the seek), the single play attempt resolves but stalls, or the seek throws and the clip never restarts.
- No verification step exists anywhere: nothing checks "did playback actually start?" after a transition.

## Plan

### 1. `triggerFloatingVideoPlay()` — the explicit trigger (new function in `QuestionVideoPane.tsx`)
Called every time the active floating number changes. Responsibilities:

1. Grab the single shared `<video>` element and the active section.
2. Ensure the element is positioned at the section's start.
3. Explicitly call Play via the existing `playWithSound` path (keeps the sound-on rule and deliberate-mute respect untouched).
4. **Verify:** after a short settle (~150 ms) and on the `playing` event, check `el.paused === false`.
5. **Retry on readiness:** if still paused, listen once for `canplay` / `seeked` and Play again; plus one bounded timed retry (~500 ms). Bounded — max ~3 attempts — so it can never loop forever.
6. Clean up listeners on every new trigger and on unmount.

### 2. Wire it in without touching autoplay
- `goTo()` keeps its current behaviour; after it runs, `triggerFloatingVideoPlay()` schedules the verify/retry pass for the new `activeKey`.
- A small effect on `activeKey` runs the trigger so **every** path that activates a floating number (chip, #, Next/Previous, Present, line-marking) gets the explicit Play — not just the autoplay ones.
- Respect user intent: if the student deliberately paused with the Play/Pause button within the *same* active line, the trigger does not fight them — it only acts on line/floating-number **changes** (tracked via `handledLineRef`/`activeKey` change), exactly like the current line effect.
- Mute preference is untouched: the trigger forces **playback**, never unmutes. `muted` / `volume` / `forcedMute` logic stays byte-identical.

### 3. Nothing else changes
- No changes to `playWithSound`, the audio latch, the mute button, ThreeViewFrame, sections, or the guest board — they all consume this component.

## Files
- `src/components/smartboard/QuestionVideoPane.tsx` — add `triggerFloatingVideoPlay` + the `activeKey` watch effect; everything else preserved.

## Verification
- `bunx tsgo --noEmit` typecheck.
- Browser test on a video question: step Line 1→2→3→4→5 and back; confirm the video plays (and `video.paused === false`) at every transition, with sound on, and that a deliberate mute stays muted across transitions.
