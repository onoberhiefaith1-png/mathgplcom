# Preview and Gameplay Become Separate Runtimes

Preview is a disposable test run. Gameplay is the real student session. They stop sharing narration memory, and the editor gains two independent clocks.

## 1. Start Preview = brand new game

Pressing Start Preview (or Replay preview) rebuilds the whole simulation from zero:

- Video seeks to 0:00 and plays from the beginning.
- Every Learning Point returns to "upcoming" — no cleared, active or exiting loops carry over.
- Every narration becomes available again, including Play Once clips.
- Any narration still speaking is cut off.
- Game Timer resets to 0:00.

## 2. Play Once / Repeat

- Preview: Play Once means once per preview run. A loop wrapping back over the timestamp does not replay it, but the next Start Preview does.
- Gameplay: unchanged intent — Play Once fires the first time the student crosses the point and never again in that session, even after leaving and re-entering the loop. Repeat fires on every crossing.

The difference is purely lifetime: preview memory dies with the preview, session memory lives for the whole student session.

## 3. Two timers in the editor

The video toolbar shows both, clearly labelled:

```text
Video Time   0:24 / 1:55
Game Timer   4:38
```

- Video Time is the playhead inside the video; it jumps back whenever a loop wraps.
- Game Timer is real elapsed time of the current preview run. It only counts while the preview is actually playing, never rewinds, and pauses when Preview is paused.
- Outside preview the Game Timer reads 0:00 (idle) so the authoring view stays quiet.

## Technical notes

- `src/lib/games/narration.ts`: `useNarrationPlayback(narrations, enabled, options?)` gains an explicit `runId` (or `sessionKey`). When it changes, the played-once set, last-time marker and audio element all reset. Keep the existing forward-crossing detection and wrap guard.
- `src/lib/games/loopRuntime.ts`: `start()` already resets loop state; add a `runId` counter that increments on every `start()` and expose it on the runtime, plus a real-time accumulator (`elapsed`, driven by an interval while `playing`, reset on `start()`, frozen on `pause()`/`stop()`).
- `src/pages/GameEditorPage.tsx`: pass `preview.runId` into `useNarrationPlayback` and drop the current `useEffect` that resets only on `active` flipping; seek to 0 on `preview.start()`; render the two-timer readout in the Preview HUD and the video toolbar using `fmtTime` from `CheckpointTimeline`.
- `src/components/gamebuilder/CheckpointTimeline.tsx`: keep the existing `0:24 / 1:55` display as "Video Time" and accept an optional `gameElapsed` prop for the second clock.
- `src/pages/student/GamePlayPage.tsx`: pass a session-scoped `runId` (the play-session id) so gameplay resets narration only when a new session begins — its Play Once behaviour is otherwise untouched.
- No database or schema change; narrations continue to live in the canvas JSON.
