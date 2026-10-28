## Technical detail

Data (staged as an additive migration; it applies when the draft is accepted, so the timer cannot be exercised in this draft until then):

- `assessments`: add `timer_enabled boolean not null default false`, `opens_at timestamptz`, `closes_at timestamptz`.
- New `assessment_timer_attempts`: `id`, `assessment_id`, `student_id`, `question_id`, `attempt_no int`, `started_at`, `elapsed_ms bigint default 0`, `running boolean default false`, `attempt_lines jsonb default '{}'` (same `questionId:lineId` keys as `solved_lines`), `completed_at`, `success boolean default false`, `created_at`, `updated_at`. Unique on `(assessment_id, student_id, question_id, attempt_no)`; index on `(assessment_id, question_id, success, elapsed_ms)` for the leaderboard. GRANTs for `authenticated` + `service_role`, RLS on: student owns their rows; the class owner may read rows for their own class's assessments.
- Best Time is derived: `min(elapsed_ms) where success`. No stored best-time column to drift.

Code:

- `src/hooks/useQuestionTimerAttempt.ts` (new): owns the current attempt for assessment × student × question — load/create, `markInput()` to start, pause/resume on `visibilitychange` and unmount, debounced `elapsed_ms` persistence, `confirmLine()`, `complete()`, `reset()`, and the derived best time. Persistence follows the debounce-and-retry shape already used by `useAssessmentBoardSession`.
- `src/components/smartboard/PresentationView.tsx`: read `timer_enabled` through the existing `source`/assessment props; when on, render the attempt row beneath the current tracker using the same circle markup, add the timer + Best Time readouts and the Reset button in the existing chrome, call `markInput()` from the existing input/commit path, and call `confirmLine()` wherever `solvedSlots` is set. The permanent tracker, `solvedSlots`, `assessScore` and the award guards are not touched. `testMode` short-circuits the whole layer.
- Reset clears the per-question board via the existing per-question board-state path plus the board's local state, then starts a new attempt.
- `AssessmentBoardPage.tsx`: fetch the new assessment columns; lock entry before `opens_at`, force `viewOnly` after `closes_at` (alongside today's `due_at` rule).
- Student assignment/class list: show the locked state and unlock time for a not-yet-open assignment.
- `AssignmentDashboardPage.tsx`: Timer/Opens/Closes controls writing to `assessments`, plus the per-question Best Time leaderboard with tie-aware positions.

Tests: attempt-row vs permanent-row separation, no duplicate award on re-solve, reset clears attempt but not `solved_lines`/score/best time, pause/resume accumulation, HH:MM:SS formatting past 24 h, success recorded only when the engine confirms every line, tie-aware ranking on millisecond values, and timer-OFF rendering identical to today.
