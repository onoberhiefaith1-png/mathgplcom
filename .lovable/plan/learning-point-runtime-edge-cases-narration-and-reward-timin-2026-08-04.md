# Learning Point Runtime — Edge Cases, Narration and Reward Timing

Four things change: a Learning Point never completes on its own, adventures may start or end inside a Loop, the reward's exit animation is timed to the remaining loop time, and the timeline gains a Narration system.

## 1. A Learning Point ends only on completion

- Reaching Loop End is never completion. The loop keeps wrapping forever.
- Completion comes only from **Next Learning Point** (Preview) or a Progress Bar reaching 100% (gameplay).
- On completion: the loop region is dropped, the Progress Bar disappears immediately, the video keeps playing from wherever it is to Loop End, then the remaining Loop objects unmount and playback travels on.

## 2. Adventure starts with a Learning Point

If Loop 1 starts at 0 (or the playhead is already inside it when Play is pressed), the runtime enters that Learning Point on the very first tick — objects appear, looping begins, no waiting for an "introduction".

## 3. Adventure ends with a Learning Point

If the final Loop's end is the end of the video, reaching it does **not** finish the adventure and does **not** show Complete Adventure. It wraps back to Loop Start and keeps looping until Next / 100%.

The engine also stops treating the video's `ended` event as an adventure ending while an incomplete Learning Point is active.

## 4. Reward exit animation is auto-timed

When a Learning Point is completed at playhead `t`:

```text
animation duration = Loop End − t
```

- Progress Bar: hidden instantly.
- Reward: stays visible and travels upward, arriving exactly as the playhead leaves the Loop.
- `t` at or past Loop End → the reward disappears immediately (duration 0).

Intermediate points: reward travels up, is silently marked collected, no Gallery. Final point: after the upward travel, the Gallery opens showing every previously collected reward already in place, only the newest one animating in, then the victory sequence and Complete Adventure.

If the video continues past the final Loop (conclusion / credits), the reward finishes its travel during the exit lap, the conclusion plays normally with no further reward animation, and the Gallery + ending fire when the video reaches its end.

## 5. Narration

A **Narration** button sits beside Set Start on the video toolbar. It opens a small floating panel next to the timeline:

- A list of narrations for this adventure, each with its timestamp and playback mode.
- Select an existing narration, **Upload Narration** (MP3/WAV), or **Record Narration** in-browser.
- The blue playhead is the activation point: move it, then press **Assign Narration** to attach the selected narration to that exact timestamp (e.g. `0:18 — Temple Introduction`).
- Two playback modes per narration:
  - **Play Once** (default) — fires the first time the playhead crosses the point in a session; loop wraps do not replay it; resets when a new session or Preview run starts.
  - **Repeat Every Activation** — fires on every crossing.
- Narrations can be renamed, re-timed and removed from the panel.

Narration audio plays in both Preview and live gameplay, layered over the video's own audio.

## Technical plan

### Data
- `src/lib/games/types.ts`: add `Narration { id, title, path, source, at, mode: "once" | "repeat" }` and `narrations?: Narration[]` on `GameCanvas`. Audio files upload to the existing game-assets bucket (same signed-URL path as video), so no migration is needed — narrations live in the game's canvas JSON.

### Runtime (`src/lib/games/loopRuntime.ts`)
- Keep `upcoming → active → completed → hidden`, but make activation edge-case safe: on `start()` and on every `onTime` tick, if no loop is active and the playhead is inside an uncleared loop, activate it (covers Loop 1 at 0:00 and re-entry after a wrap).
- Add `completedAt: number | null` and expose `exitDuration = max(0, loopEnd − completedAt)` plus `barsHidden` (true from the moment of completion) for the exit lap.
- `complete()` for the final loop no longer stops playback: it enters the same exit lap, then sets `ended` once Loop End (or video end) is reached.
- Add `videoEnded()`: ignored while an active loop is incomplete (the wrap keeps it alive); otherwise it ends the adventure.
- `visibleLoopElements` gains: drop `progress_bar` elements when `barsHidden`, keep `reward` elements through the exit lap.

### Editor (`src/pages/GameEditorPage.tsx`)
- Narration toolbar button + panel state; pass `narrations` through the canvas save path.
- Preview wiring uses the new `exitDuration` / `barsHidden` and no longer freezes on final completion.

### New components
- `src/components/gamebuilder/NarrationPanel.tsx` — library list, upload, MediaRecorder recording, mode toggle, Assign Narration at the current playhead.
- `src/lib/games/narration.ts` — `useNarrationPlayback(narrations, { active })`: signed-URL cache, one `Audio` per narration, crossing detection with a per-session fired set, reset on start.

### Video layer (`src/components/gamebuilder/VideoBackgroundLayer.tsx`)
- Wrap on `ended` as well as `timeupdate` when a loop region is set, so a loop that ends at the exact end of the video still wraps.

### Gameplay (`src/pages/student/GamePlayPage.tsx`)
- Drive reward exit offsets from `exitDuration` (pass it into `useRewardTransfer` as the transfer duration) instead of the fixed Gallery speed for video adventures.
- Route the video's `onEnded` through the runtime's `videoEnded()`; keep the deferred Gallery + victory on `ended`.
- Mount `useNarrationPlayback` for the played canvas.
