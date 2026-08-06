# Video Adventure – Restart Game & One Shared Timer

Three fixes, all inside Video Adventure. Static Adventure is untouched.

## 1. Restart Game resets the story only

Restart currently clears the challenge rows and the teacher's playhead, but the shared
Time Bar row (the countdown behind the on-canvas bar) is left running from the previous
run, so timers survive a restart.

Restart will:

- seek the video to 00:00 and re-arm the master timeline,
- delete all Learning Point challenge rows (already happens),
- reset the shared Time Bar row to a stopped, full state,
- clear the teacher's local loop state (cleared / exiting points).

Restart writes nothing to student score, gallery, award or group tables. A short comment
plus a review of the restart path guarantees this; the confirmation text stays
"Student progress and scores are kept."

## 2. One timer, owned by the teacher

Today the countdown a student sees drawn on the canvas comes from a separate per-game
timer row, while the teacher's canvas countdown comes from the active Learning Point
challenge. That is why the two clocks disagree.

The student's on-canvas Time Bar and the numeric countdown will both be driven by the
teacher's active challenge (start time, pauses, duration) — the same source the teacher's
own bar uses. When the teacher enters a point, starts, pauses, resumes, changes the
duration or restarts, every student's bar and clock change in the same moment through the
existing live channel. No student-side timer state remains.

Outside a Learning Point there is no timer on the student screen, matching the teacher.

## 3. Restart respects each student's existing score

When the replayed video reaches a Learning Point, each student is measured against that
point's required mark using their own already-earned score:

- **Already at or above the required mark** — no Progress Bar, no timer, no question panel.
  The student keeps watching the synchronized video. A small "Completed" note is shown so
  it is clear why nothing opened.
- **Below the required mark** — Progress Bar and the teacher's synchronized timer appear,
  questions unlock, and the score continues from where it already stood (never reset to 0).

The teacher's dashboard is unchanged in how it decides when a point ends (class/group
required mark, or the timer expiring).

## Technical notes

- `useVideoAdventureRun`: add a `resetTimers` step to `startGame` that also stops/refills
  the `game_time_bars` row for the game; keep the existing challenge-row delete. Expose
  `challengeRemainingMs(sceneId)` so both screens read one derivation.
- `AdventureDashboardPage.tsx`: `startGame` calls the time-bar reset and clears
  `clearedSceneIds` / `exitingSceneId` (already partly present).
- `GamePlayPage.tsx`: replace `useGameTimeBar`-driven Time Bar rendering, `timeUp` and
  `expired` inputs for the video path with the teacher challenge clock
  (`teacherRun.activeChallenge` + `remainingMs`). Static path keeps `useGameTimeBar`.
- Per-student gate: compute the student's own marks for the point's learning bars from
  `sync.scoresByAssessment[assessmentId][userId]` against
  `round(bar.total * challenge.required_pct / 100)`; when met, filter the point's bars and
  suppress `openBarId` / the solving panel for that student only.
- No database or schema changes.
