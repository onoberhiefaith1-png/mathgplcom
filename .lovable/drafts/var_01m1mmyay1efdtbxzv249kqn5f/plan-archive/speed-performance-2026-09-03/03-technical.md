## Technical detail

**Existing pieces reused as-is**
- `assessment_timer_attempts` (per assessment/student/question, `elapsed_ms`, `success`) and `guest_question_times` — nothing about how they are written changes.
- The existing `question_best_times` function already proves the pattern: own best plus overall best across students and guests.
- Reports live at `/teaching-hub/classes/$classId/report` (teacher, `ClassReportPage`) and `/student/class/$classId/report` (student, `StudentReportPage`).

**Staged database work** (additive; applies when the draft is accepted)
- `speed_record_history` — one row each time an overall record for a question is beaten: `assessment_id`, `question_id`, `holder_id` (nullable for guests), `holder_kind`, `best_ms`, `set_at`. Written by a trigger on successful timer attempts and guest times; the trigger only appends when the new time beats the current best. Grants + RLS: teachers of the class read, `service_role` all, no anon.
- `speed_performance_student(_class_id uuid)` — security definer, returns per question: `assessment_id`, `question_id`, `assignment_title`, `question_label`, `my_best_ms`, `overall_best_ms`, `i_hold_record`. Returns no identities at all.
- `speed_performance_teacher(_class_id uuid, _notebook_id uuid)` — security definer, gated on class ownership: per question the overall best, holder id/kind, and every enrolled student's best time.
- `speed_records_held(_class_id uuid)` — count of currently-held records per student, for the future rewards layer.

**New client code**
- `src/lib/reports/speedPerformance.ts` — typed loaders over the three functions plus a `formatAttemptTime` reuse from `useQuestionTimerAttempt`.
- `src/components/reports/SpeedPerformanceCard.tsx` — the entry card added to both report pages.
- `src/components/reports/speed/StudentSpeedTable.tsx`, `TeacherSpeedPanel.tsx` (assignment picker, overall-best/record-holder summary, student best times, record history) using the existing report surface classes, cards, typography and spacing.
- Routes `.../report/speed/index.tsx` for teacher and student, the teacher route behind the existing class-owner check, the student route behind `StudentFeatureGate item="reports"`.
- Mobile: student rows collapse to stacked cards; the teacher table becomes cards under `sm`, so no identity ever leaks through a layout change.

**Tests**
- Best-time selection ignores a slower later attempt.
- Overall best switches holder when a faster time arrives, and history keeps both entries.
- Student payload shape contains no name/id fields.

**Out of scope**: timer behaviour, attempt creation, assignment expiry, marking, averages/streaks, reward mechanics, and any change to the existing report charts.

The new tables and functions only exist in the app once this draft is accepted, so the dashboard can be reviewed end to end after that.
