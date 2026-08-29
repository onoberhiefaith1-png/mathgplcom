## Technical detail

**Data (staged, applies when the draft is accepted)**
- `guest_attempts` currently has no question or timing column, so guests cannot yet contribute a time. Add, additively: `question_id text`, `elapsed_ms bigint`, `success boolean default false`, plus an index on `(assessment_id, question_id)`.
- Add a security-definer function `public.question_best_times(_assessment_id uuid, _question_id text)` returning `my_best_ms bigint, overall_best_ms bigint`:
  - `my_best_ms` = min `elapsed_ms` from `assessment_timer_attempts` where `success` and `student_id = auth.uid()`.
  - `overall_best_ms` = least of the min successful `elapsed_ms` in `assessment_timer_attempts` and in `guest_attempts` for that assessment + question.
  - Granted to `authenticated` and `anon` (a guest board also shows the benchmark). It returns only two aggregate numbers — never rows, names or identities.

**Client**
- `src/hooks/useQuestionTimerAttempt.ts`: keep all attempt logic as-is; alongside the existing `bestMs`, expose `overallBestMs` from the new function, refreshed on load and after `complete()`.
- `src/components/smartboard/PresentationView.tsx`: replace the single "Best" button with two read-only chips — `My Best` and `Overall Best` (`formatAttemptTime`, `—` when absent). Remove the `QuestionLeaderboardPanel` mount, its open state and the click handler.
- `src/components/smartboard/QuestionLeaderboardPanel.tsx` and `src/lib/assessments/questionLeaderboard.ts` (plus its test) are deleted once nothing imports them. `AssignmentTimerPanel.tsx` (teacher dashboard) keeps its own ranking and is not touched.
- Guest timing: `src/components/guests/GuestBoard.tsx` / the guest grading path record the guest's question elapsed time and success onto their `guest_attempts` row, so the benchmark includes them.

**Verification**
- Typecheck, run the assessments test suite, and check a timed question shows two values that behave per the rules (repeat attempts lower My Best only; a faster foreign attempt lowers Overall Best).
- The new columns and function only exist after the draft is accepted, so the guest contribution and the live values can only be confirmed there.
