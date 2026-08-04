# Video Adventure Preview — Manual Learning Point Control

Preview becomes a director's run-through: the video plays, stops at each Learning Point and loops there forever until the teacher presses **Next Learning Point**. Live gameplay is unchanged in feel — the student's progress bar replaces that button.

## 1. Play Preview (currently disabled)

The "Play Preview" button in the editor toolbar is a disabled "Coming soon" chip today. It becomes a real preview overlay for video adventures:

- Video starts from 0 and plays the introduction normally.
- Only objects of the loop the playhead is inside are visible (the loop-visibility rule already built for the editor).
- On reaching a loop's start, the preview enters that loop: the loop's reward, progress bar(s), time bar, characters, effects and question markers appear, and the region loops indefinitely.
- Preview never auto-exits a loop. It waits for the teacher.

Preview controls while running: **Play**, **Pause**, **Next Learning Point**, **Exit Preview**. `Next Learning Point` exists only in preview — never in student gameplay.

## 2. Next Learning Point

Pressing it simulates a completed checkpoint:

1. The loop's progress bars snap to full (preview-only visual state, nothing written to the database).
2. The reward plays its exit animation.
3. The loop is marked cleared, but the video keeps playing to the loop's end — no jump. At 24.7s in a 20–30s loop it continues 24.7 → 30 naturally.
4. On reaching loop end, all of that loop's objects unmount and normal playback resumes toward the next loop.
5. A cleared loop is never re-entered and its objects never come back.

Final Learning Point instead simulates the ending: final reward collected, gallery/victory sequence, End Adventure — and preview stops there. Intermediate points never open the gallery.

## 3. Same smooth exit in real gameplay

Gameplay today clears a loop and drops the loop region the instant the bars complete, which can cut the shot. It changes to the same rule: on completion the reward leaves, the loop keeps playing to its end, then objects unmount and normal playback continues. Students see one continuous cinematic, no seek jump.

## 4. Progress bar names

Every progress bar gets an editable name (default "Progress Bar"), stored on the element's existing `label` field:

- A **Name** input at the top of the progress bar's settings in the right-hand properties panel.
- The name shows in the editor rail, the preview HUD, group/link dialogs, and anywhere a bar is chosen (course/adventure assignment, smart-card setup, class adventure dashboards) instead of the generic "Progress Bar".
- Links stay keyed by bar id internally; only the display text changes.

## Technical notes

- `src/lib/games/videoPreview.ts` (new): a `usePreviewRuntime` hook holding `playing`, `activeLoopId`, `clearedLoopIds`, `exiting` (loop id awaiting its natural end) and `simulatedFull` bars; exposes `next()`, `play()`, `pause()`, `reset()`. Loop entry/exit reuse `checkpointAt` / `checkpointsOf` / `isFinalStage` from `types.ts` and `stages.ts`.
- `src/pages/GameEditorPage.tsx`: enable the Play Preview button for video mode; render a preview overlay over the existing `VideoBackgroundLayer` + `GameCanvas` (canvas `editable={false}`, elements filtered to the active loop, bars driven by the simulated marks). Exiting preview restores the authoring playhead state.
- `src/components/gamebuilder/VideoBackgroundLayer.tsx`: keep the loop region while `exiting` is set but let it run past `end` once (drop the region on the exit tick) so the region finishes instead of wrapping.
- `src/pages/student/GamePlayPage.tsx`: on stage completion set an `exitingCpId` and only clear the loop/stage when `videoTime` reaches `loopEnd`; keep the existing reward transfer, deferred gallery and final-stage behaviour.
- `src/components/gamebuilder/SettingsPanel.tsx`: Name field writing `element.label`; bar pickers in `LinkAdventureDialog.tsx`, `GroupsPanel.tsx`, `AssetsPanel.tsx`, `ClassAdventuresPage.tsx`, `AdventureDashboardPage.tsx`, `SmartCardGameSetupPage.tsx` fall back to "Progress Bar" only when `label` is empty.
- No database migration — `label` already exists on canvas elements.
