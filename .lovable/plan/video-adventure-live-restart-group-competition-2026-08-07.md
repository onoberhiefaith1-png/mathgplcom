# Video Adventure – Live Restart & Group Competition

Two connected changes: Restart Game must stop trusting remembered state, and Group Mode must
turn each Learning Point into a timed competition instead of a race.

## What is wrong today (verified in the code)

- The teacher dashboard remembers which Learning Points are finished in a local set
  (`clearedSceneIds` in `AdventureDashboardPage.tsx`). A point in that set is skipped when the
  video passes it again, regardless of the current class, current scores or the current required
  mark. That is the cached completion state the spec forbids.
- A group's pass/fail is stored permanently on the group row (`qualified`,
  `eliminated_at_scene_id`, `completed_at`, written by `setGroupQualification`). Restart Game does
  not clear it, so a group eliminated in the previous run stays eliminated and View Only for the
  whole replay.
- A Learning Point currently ends **the moment** the required mark is reached
  (`challengeMet || runtime.expired` → `endChallenge`). Under Group Mode this ends the competition
  early for everyone, so a filled bar cannot "wait for the timer".
- Per-bar totals themselves are already live: `useAdventureSync` recomputes grand total, required
  mark and achievement from current members and current group scope on every change, so adding or
  removing students already moves the numbers. What does not react is the *decision* built on top
  of them (the two cached states above).

## 1. Learning Point status becomes a live calculation

Replace the remembered "cleared" set with a derived status for each Learning Point, recomputed
whenever members, scores, required mark or bar links change:

```text
grand total   = bar total marks x students currently in scope (class or group)
required      = grand total x goal % x Learning Point required %
achievement % = achieved / required
status        = Completed        when achievement >= required
                Active           when the video is inside the point and it is not Completed
                Needs more work  when it was Completed but a class change dropped it below
```

Consequences, all automatic:

- Add 5 students to a class of 10: the grand total and the required mark rise, achievement falls,
  and a previously completed point becomes eligible again — when the replay reaches it, it opens.
- Remove 5 students from 20: the required mark falls; a point that was short can now already be
  satisfied, and the replay passes straight through it.
- Change the required pass mark or the duration on the dashboard: the status recomputes at once.
- No students in the class: nothing is satisfied, so every point opens normally.

## 2. Restart Game clears run state only

Restart continues to reset the video to 00:00, the teacher timeline, all loop states and all loop
timers, and continues to write nothing to student scores, gallery, awards or boards. It gains one
missing step: every group is returned to a neutral, unjudged state (qualified again, no elimination
scene, no completion stamp) so the replay judges groups from live data rather than the last run.

The confirmation text stays "Student progress and scores are kept."

## 3. Per-student gate on replay

Unchanged in intent and already partly in place: when the replayed video reaches a Learning Point,
a student already at or above the required mark gets no progress bar, no timer and no question
panel and keeps watching the synchronized video; a student below it gets the bar and the teacher's
timer and continues from their existing score. This gate is recomputed from live scores and, in
Group Mode, from the student's own group bar rather than the class bar.

## 4. Group Mode is a timed competition

Only when at least one group exists:

- Creating Group B, C, … keeps duplicating the original bar, which stays the template: the
  duplicates inherit its lesson note, questions, required mark, time limit, goal percentage and
  reward rules.
- The original (primary) bar becomes read-only on the dashboard — its name, linked note, required
  mark and duration cannot be edited there. Duplicates stay editable for group name, assigned
  students and appearance; the inherited gameplay rules stay fixed.
- Each group scores only from its own assigned students, with its own grand total, achieved score
  and percentage (this scoping already exists and stays).
- **Reaching 100% no longer advances anyone.** The bar fills, the group waits, the countdown keeps
  running and the Learning Point stays open for every group until the timer reaches zero.
- At zero the point ends for everyone at the same instant and all groups are judged once from live
  numbers: groups on target advance with the story; groups short of it stop travelling, switch to
  View Only (no bar interaction, no questions) and see the teacher's encouraging completion
  message. Passing groups never see it.
- Without groups the current behaviour is unchanged: a point may still close as soon as the class
  reaches the required mark.

## Technical notes

- `AdventureDashboardPage.tsx`: delete `clearedSceneIds`; derive `pointStatus(sceneId)` from
  `patchedBarSummaries` + `runtime.challengeFor(sceneId)` and use it in `onVideoTime` to decide
  whether to call `openChallenge`. Gate the early `endChallenge` on `groups.groups.length === 0`;
  in group mode only `runtime.expired` ends a challenge. Restart calls a new group reset.
- `src/lib/adventures/groups.ts`: add `resetGroupJudgements(classId, gameId)` clearing `qualified`
  (to true), `eliminated_at_scene_id`, `completed_at`, plus the stored race winner.
- `useVideoAdventureRun.startGame`: call the group reset alongside the existing challenge-row
  delete and time-bar reset.
- `useGroupOutcome`: reset `judgedSceneRef` / `winnerWrittenRef` when the run's `started_at`
  changes, so a replay re-judges each point.
- `GroupsPanel.tsx` / bar settings on the dashboard: lock inherited fields on the primary bar.
- `student/GamePlayPage.tsx`: `myPointMet` picks the student's group bar when they are in a group;
  keep suppressing bars/panel for satisfied students and honour View Only for waiting groups.
- No schema changes.
