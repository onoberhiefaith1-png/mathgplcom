# One Adventure Engine: Staged Scenes, Staged Loops, Deferred Gallery

Both modes become the same engine driven by an ordered list of **stages**. A stage owns everything inside it (reward, progress bar, time bar, effects, characters, particles, questions). Only the **final** stage opens the Class Gallery.

- Static Adventure: stage = Scene (Scene 1, Scene 2, Scene 3…)
- Video Adventure: stage = Loop Region inside one continuous video

## Part 1 — Static Adventure: real multi-scene play

Today a saved game with several scenes is merged into one tall canvas, so there is only ever "one scene", and the first full progress bar navigates straight to the Gallery.

Changes:
1. Stop merging scenes for games saved in the new format; keep the merge only as a one-time migration path for legacy rows so nothing existing breaks. New games keep `scenes[]` in play order, each with its own elements and camera target.
2. Editor gets a Scene strip (add / rename / reorder / delete scene, select scene). The canvas edits exactly one scene at a time; nothing from another scene renders.
3. Runtime plays scene by scene:
   - student solves → bar reaches its teacher-set goal → reward lifts out of the scene and fades away
   - every element of that scene is unmounted (reward, progress bar, time bar, effects, characters, particles, floating objects, lighting)
   - next scene mounts fresh (its own timer restarts, its own bars start empty)
4. Gallery does not open between scenes. Rewards earned in scenes 1..n-1 are recorded silently.
5. After the last scene's reward leaves, the Gallery opens and animates the rewards, then the game ends.

## Part 2 — Video Adventure: same flow, loops instead of scenes

Editing:
- Right after a video upload, the only live controls are the video timeline plus Set Start / Set End. Background, Reward, Progress Bar, Add Effect, Time Bar and Questions stay disabled until the first loop exists.
- Setting Start + End creates Loop 1 and unlocks the full authoring toolset. Everything created belongs to the selected loop only.
- Switching loops hides the previous loop's objects and shows the selected loop's objects. One loop = one independent workspace, no leakage.

Gameplay:
- Video plays with no overlays until it reaches a loop's start.
- At the loop, that loop's reward, progress bar, timer, effects and questions appear and the video loops that region endlessly.
- On win: loop stops, reward leaves the screen, **all** loop objects are removed, video continues naturally to the next loop.
- Only the final loop opens the Gallery → treasure animation → end game.

## Part 3 — Editor layout: canvas first (80 / 20)

- Top toolbar unchanged in purpose, trimmed to fit.
- Canvas takes ~80% of the width and full remaining height — large viewport for drag, resize, rotate and placement.
- One fixed right panel (~20%, collapsible) replaces the current stacked Layers rail + wide settings drawer. Inside it, sectioned: Layers, Selected object, Loop/Scene, Reward, Progress bar, Time bar, Effects, Camera, Questions.
- Bottom timeline: video timeline with loops in video mode; Scene strip in static mode.

## Technical notes

- New `src/lib/games/stages.ts` + `useAdventureStage` hook: ordered stages, current stage id, per-stage element ids, completion detection from `barSummaries`, `isFinalStage`.
- `src/lib/games/types.ts`: keep `Scene` as the single stage type (already doubles as Checkpoint); gate the multi-scene flatten in `normalizeCanvas` behind a legacy check; `playableElements` becomes stage-scoped for both modes.
- `useRewardTransfer` gains `deferGallery` / `onStageAwarded`: it always runs the exit animation and writes the award row, but navigates to the Gallery only on the final stage. The gallery URL then carries all rewards awarded in this game run.
- `src/pages/student/GamePlayPage.tsx`: single stage machine used by both modes (advance scene vs resume video), stage-scoped `visibleElements`, per-stage timer reset, existing Retry / Turn back preserved.
- `src/pages/GameEditorPage.tsx`: layout refactor to canvas 80% + single right panel, new Scene strip, upload-gating for video mode.
- No schema change required — stages already live inside `games.canvas`; awards already recorded in `class_gallery_awards`.
