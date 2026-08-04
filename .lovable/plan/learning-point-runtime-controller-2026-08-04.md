# Learning Point Runtime Controller

Split the Learning Point state machine out of the editor and the gameplay page into one shared runtime, and remove the debug text from the canvas.

## What changes for you

- One engine drives both Preview and live gameplay. The only difference is what marks a Learning Point complete: the teacher's **Next Learning Point** button in Preview, the filled progress bar in gameplay.
- Pressing **Next Learning Point** never moves the video. It flips a single `completed` flag; the loop plays out to Loop End once more and then playback continues naturally.
- Every object (reward, progress bars, time bars, effects, characters, questions) exists only while its Learning Point is Active or finishing its exit lap. Upcoming and Completed points show nothing.
- The on-canvas message "Outside a Learning Point — objects hidden" is removed. The canvas always looks like the real game; the same information goes to the developer console only.
- **Next Learning Point** sits beside Play/Pause, disabled when no Learning Point is active, enabled while one is looping.
- The final Learning Point still ends the adventure: gallery + victory.

## Technical plan

### 1. New shared controller: `src/lib/games/loopRuntime.ts`

Replaces `src/lib/games/videoPreview.ts` (that file becomes a thin re-export of `barName` plus the new hook, so existing imports keep working).

```text
type LoopState = "upcoming" | "active" | "completed" | "hidden"
```

`useLoopRuntime({ loops, seek, autoComplete })` returns:

- `stateOf(loopId): LoopState`
- `activeLoopId`, `exitingLoopId`, `completedIds`, `ended`
- `loopRegion` — `{start,end}` while Active, `null` once completed (this is what stops the wrap)
- `visibleElements(all)` — only the active/exiting loop's elements; progress bars snap to full during the exit lap
- `complete(loopId)` — the single `completed = true` mutation used by both the Next button and the progress-bar-full path
- `onTime(t)` — activates on entering a loop region, ends the exit lap at Loop End, then hides objects and travels on
- `start/stop/play/pause`, `playing`

Wrap rule stays where it already is (`VideoBackgroundLayer` honours `loop`); the controller simply stops publishing a region for a completed loop, so no jump or rewind occurs.

### 2. `src/pages/GameEditorPage.tsx`

- Use `useLoopRuntime` in place of `usePreviewRuntime`; keep the existing HUD wiring (Play, Pause, Next Learning Point, Exit Preview) and the final-loop gallery/victory branch.
- Delete the debug block rendering "Outside a Learning Point — objects hidden" (~line 2009-2013); replace with a `console.debug` in the existing playhead effect.
- Keep editor-side loop-based visibility (`playheadLoop`) as-is.

### 3. `src/pages/student/GamePlayPage.tsx`

- Remove the duplicated `activeCpId` / `exitingCpId` / `doneCps` machinery and drive video mode from `useLoopRuntime` with `autoComplete` fired when a stage's progress bars hit their goal.
- Timer, reward transfer, gallery and victory hooks stay attached to the controller's `activeLoopId` / `ended` instead of local state.
- Static (non-video) adventures keep the existing stage stepping untouched.

No database or schema changes.
