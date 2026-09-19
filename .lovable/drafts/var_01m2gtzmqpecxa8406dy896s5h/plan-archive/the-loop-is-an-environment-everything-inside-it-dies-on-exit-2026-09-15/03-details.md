## Audio Library controls

- One button per clip that toggles **Play → Pause**, pausing at the current position and resuming from there. Only one library clip previews at a time; opening or switching clips stops the previous one. Restart stays a separate deliberate action.
- Clicking a clip opens its controls (name, Play Once / Repeat, Assign, current assignment, Delete) without moving the playhead.
- A clip already assigned shows its assignment (for example "Assigned — Learning Point 2 · 0:57") and its Assign control goes dormant until the assignment is removed. Removing it makes the clip assignable again.

## Technical notes

**Stage ownership of narration** — `src/lib/games/narration.ts`: keep the current "narration runs forward across laps" behaviour, and add an owning stage to the speaking clip. New runtime call `onLoopEnd`/`onStageChange(stageId)` stops the narration channel whenever the live stage id changes or clears, so a lap (same id) is silent-safe while a pass, fail, skip or navigation away is a hard stop. `isLoopLap`/`regionAt` stay as they are; the loop-edge cut that was removed is not reintroduced.

**Single conductor** — the stop is driven from the one place that already knows the stage: `useLoopRuntime` (`src/lib/games/loopRuntime.ts`) in the editor via `preview.activeLoopId` / `exitingLoopId`, and `activeStage` in `src/pages/student/GamePlayPage.tsx` and `src/pages/class/AdventureDashboardPage.tsx`. Video, narration, music and effects all key off that same value — no second timer.

**Ordinary Play plays audio** — `src/pages/GameEditorPage.tsx` currently enables the narration runtime and `useAdventureAudio` only when `preview.active`. Both become enabled for `preview.active || videoPlaying`, with the plain-Play path feeding `narrationRuntime.onTime(t)` and the stage id from `playheadLoop`, so Play and Preview share one engine. Pausing Play stops the sound; authoring scrubs still stop narration as now.

**Repeat inside a stage** — `mode: "repeat"` keeps re-firing only while the owning stage id is unchanged; the stage change stop pre-empts any queued repeat.

**Library panel** — `src/components/gamebuilder/NarrationPanel.tsx`: single shared `HTMLAudioElement` with play/pause state per clip id, assignment badge derived from `n.at` plus the checkpoint it falls inside (panel receives the checkpoint list), a Remove-assignment action setting `at: -1`, and `Assign` disabled while assigned.

**Acceptance run** — 10s loop with a 60s clip, started from Play (not Preview): narration begins, laps do not restart it, completing the stage at 0:30 stops loop, narration and stage audio at once and starts the next segment's narration; library Play/Pause resumes rather than restarts; assign, confirm dormant controls, remove, confirm assignable again.

Out of scope: Gallery, reward/scoring logic, timeline visual design.
