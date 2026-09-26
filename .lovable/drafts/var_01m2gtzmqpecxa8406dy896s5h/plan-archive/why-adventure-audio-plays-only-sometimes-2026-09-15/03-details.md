## Technical details

Confirmed by reading the current code:

- `src/lib/games/audio.ts` — `playNarration` pauses the single `narration` element, overwrites `src` and resets `currentTime` on every call. Concurrent clips cannot coexist. `gated()` queues plays until `unlockAudio()` and never expires, so a stale queue flushes late.
- `src/lib/games/narration.ts` — `onLoopStart` loops over every clip inside the region and calls `speak` for all of them in one pass, adding each to `playedRef`. The `enabled=false` effect (line ~157) clears `lastTimeRef` to 0, so resuming from pause makes `onTime` see `prev=0` and mass-fire. `onStageChange` calls `stop()` on any id change including `null → id`. `fire()` returns silently when `getSignedUrl` yields `null`.
- `src/pages/GameEditorPage.tsx` — `unlockAudio()` is only called from the two Preview buttons (lines 1838, 2028); the plain Play toggle never calls it. `mediaLive`/`onTime` already share one runtime, which stays.

### Changes

**`src/lib/games/audio.ts`**
- Add a narration queue owned by the bus: `enqueueNarration(items)` plays sequentially via the element's `ended` handler; `playNarration` keeps its immediate-play meaning for one-off previews.
- Add `pauseChannel(ch)` / `resumeChannelPlayback(ch)` that hold and continue `currentTime` without clearing `src`.
- Bound the unlock queue: only the latest pending narration request survives, so nothing bursts out late.

**`src/lib/games/narration.ts`**
- `onLoopStart` collects due clips, sorts by `at`, and hands them to `enqueueNarration` as one ordered batch instead of firing them in a loop. Same for multiple crossings in a single `onTime` tick.
- Resolve signed URLs for the whole batch up front; a clip whose URL fails is logged and skipped without consuming the batch.
- Stop clearing `lastTimeRef` when `enabled` flips false; keep the position and add `pause()`/`resume()` to the runtime, wired to the pause/resume of Play and Preview. Only `reset()` and a new `runId` wipe memory.
- Track the stage each speaking clip belongs to. `onStageChange` stops only clips owned by the stage being left; a clip pinned before the loop (owner `null`) plays on.
- Keep `isLoopLap` / `regionAt` and the scrub-stops-sound rule unchanged.

**`src/pages/GameEditorPage.tsx`**
- Call `unlockAudio()` in the plain Play/pause toggle as well as Preview, so both grant sound from the click.
- Route the Play pause button through `narrationRuntime.pause()` / `resume()` instead of relying on `enabled` flipping.

### Tests

Extend `src/lib/games/narrationWindow.test.ts`: two clips in one region speak in order and neither is dropped; repeated laps never restart or re-fire; pause then resume does not re-fire earlier clips; a clip before a loop survives the loop becoming active; leaving the stage stops only that stage's clip; a failed URL does not block the rest of the batch.

Verification: focused game tests, typecheck, and a preview run of this adventure with one clip before a loop and two inside it, checked on Play, Preview and after a scrub.
