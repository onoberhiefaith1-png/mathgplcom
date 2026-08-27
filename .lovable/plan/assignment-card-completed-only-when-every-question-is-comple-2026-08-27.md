# Assignment Card: Completed only when every question is completed

## What is wrong today

The shared progress aggregator marks a student `Completed` as soon as **any one**
question in the Assignment Card reports completion. So a student who finished
Question 1 of three already lands in the Completed bucket on the teacher
dashboard.

Inactive and In Progress are driven by live Smartboard presence and are correct —
they stay untouched.

## The change

One condition changes, in the shared aggregator used by the Assignment Dashboard:

- Count the questions belonging to the Assignment Card (all active assessment
  records for that lesson note in that class).
- Count how many of those questions the student has actually completed.
- `Completed` only when completed questions equal the total number of questions
  in the card (and the card has at least one question).
- Otherwise the student falls back to the existing presence rule: Smartboard open
  now → In Progress, otherwise Inactive.

Score, total marks and the progress percentage stay exactly as they are; score is
never used to decide Completed.

The Adventure path uses a separate contribution-target rule and is left alone.

## Technical scope

- `src/lib/assessments/lessonProgress.ts` — replace the `anyCompleted` flag with
  a per-student count of completed questions, compared against the number of
  assessments passed in.
- Regression tests covering: one of three questions completed → not Completed
  (Inactive when offline, In Progress when present), all questions completed →
  Completed, and a full-marks-but-not-submitted question → not Completed.
- No database, RLS or student-side changes.
