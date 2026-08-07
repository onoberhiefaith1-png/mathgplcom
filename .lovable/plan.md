# Video Adventure – Architecture Fixes

Five foundation fixes before any new features: group creation, student movement, per-group scoreboard bars, two independent clocks, and a student interface that matches the teacher design system.

## 1. Group creation error (root cause found)

`adventure_groups` carries a unique constraint on `(class_id, game_id, progress_element_id)`. Since the scoreboard redesign every group points at the *same* master Progress Bar, so Group A saves fine and Group B collides — that is the exact "duplicate key value violates unique constraint" message.

Fix at the database level, additively:

- Drop `adventure_groups_class_id_game_id_progress_element_id_key`.
- Add a unique constraint on `(class_id, game_id, name)` instead, so two teams can't share a name but many teams can share the master bar.
- Add a partial unique index so only one group per class+game can be `is_primary`.

Group creation then simply inserts a new row with its own `id` — Group A, B, C, D each a distinct record.

## 2. Moving students between groups

The membership table already enforces one group per student per game (`unique (class_id, game_id, student_id)`), and `assignStudentToGroup` already deletes-then-inserts, so a move is never a duplicate or a delete of the student. What's missing is the interface: in the Group Setup panel each student row gets a group selector (and drag-free "Move to ▾" menu) listing every existing group plus Unassigned. Moving a student keeps every mark, because marks live on the assessment, not the group.

## 3. Duplicate Progress Bars as visual scoreboards

Duplication comes back — but only as display. Scoring stays on the one master bar.

- Each non-primary group gets a render-only bar element `grpbar-<groupId>`, rebuilt from the master bar at render time (never written into the shared Adventure canvas).
- Each duplicate is movable, resizable and restylable through the existing Progress Bar editor; position/scale/colour/preset persist on the group row (columns already exist).
- Each duplicate is filled from that group's live standing, so the class sees who is leading at a glance. All bars still represent the same Learning Point.
- The master bar keeps its original behaviour and stays the definition of questions, marks and rewards.
- The Group Competition Board (ranked list) stays as the numeric readout alongside the bars.

## 4 & 5. Game Time vs Loop Time

Two clocks, fully independent:

```text
Game Time   0:00 ─────────────────────────────► 1:55   (master, never loops)
Loop Time     CP1 10:00   CP2 8:00   CP3 5:00   CP4 12:00   (per Learning Point)
```

- **Game Time** belongs to the Video Adventure, not to any Progress Bar. It is the video's own forward timeline and keeps running/existing while a loop is active.
- **Loop Time** belongs to the current Learning Point only, is attached to its Progress Bar, and starts counting only when the video reaches that loop.
- **Restart Game** sets Game Time to `0:00`, seeks the video to the very start, clears all loop states and loop timers, and replays from the beginning. It never restarts "the current loop". Loop timers arm themselves naturally as the replay reaches each checkpoint. Student marks and scores are untouched, exactly as today.
- The dashboard shows both readouts, clearly labelled `Game Time` and `Loop Time`, and students mirror the teacher's values.

## 6. Student interface matches the teacher design system

Layout is unchanged — only the visual language is applied: the same premium section themes, card treatment, spacing scale, typography, borders, shadows, gradients and transitions used on the teacher pages, across `StudentClassPage`, `StudentAdventuresPage`, `StudentGamesPage`, `StudentLessonNotesPage`, `StudentGalleryPage`, `StudentCoursesPage`, `StudentReportPage`, `StudentSmartBoardPage`, `StudentAssignmentPage` and the game/live views. Mobile touch targets and the bottom bar stay as they are.

## Technical notes

- Migration: drop the `progress_element_id` unique constraint on `adventure_groups`; add `unique (class_id, game_id, name)` and `create unique index … on (class_id, game_id) where is_primary`. No new table, so no new GRANTs.
- `src/lib/adventures/groupBars.ts`: reinstate `buildGroupBarElements` / `withGroupBars` as display-only clones sourced from the master bar id (not `source_element_id`), with `findFreeSlot` for the first placement; keep `moveGroupBar` and add scale/style writes.
- `src/lib/adventures/groupStandings.ts` stays the single source of fill; a new `fillByElementId` mapping feeds clone bars from group standings on the dashboard and student stage.
- `src/components/adventures/GroupSetupPanel.tsx`: add per-student "Move to" selector using existing `assignStudentToGroup`; no gameplay object created during setup.
- `src/hooks/useVideoAdventureRun.ts`: `startGame` writes `playhead_seconds = 0`, `started_at = now()`, resets challenge rows' `started_at`/elapsed, and leaves scores alone. Dashboard seeks the video element to 0 and calls `loopRuntime.start()` (fresh `runId`).
- `src/lib/games/loopRuntime.ts`: keep the run-scoped `elapsed` accumulator as Game Time; loop countdown is derived per challenge row (`duration_seconds − elapsedOf(row)`), never from Game Time.
- `src/components/adventures/LearningPointTimeBars.tsx` + `AdventureDashboardPage.tsx`: relabel and separate the two readouts; `GamePlayPage.tsx` mirrors both from `teacherRun`.
- Student styling uses `src/lib/theme/sectionThemes.ts` + `SectionCard.tsx`; no business logic touched.
- Quiet fix included: the realtime subscription in `useAdventureGroups` registers its `postgres_changes` handlers before `subscribe()` to clear the console error.
