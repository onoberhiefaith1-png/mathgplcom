# Game as an assignment type, MM:SS timing, student Game area and Reports

Everything already exists separately: the Game Slate with its Questions panel and repeating reward pattern, Floating Numbers (marks, question timer, per-line time), the Assign to Students dialog (Assignment / Adventure / Course), the student area, and one Reports data layer. This work connects them. Nothing is rebuilt.

Because this is large, it is delivered in three stages, each usable on its own.

## Stage 1 — Assign a Game, and MM:SS timing

**Assign to Students** gets a fourth destination, in this order: Assignment | Game | Adventure | Course. "Game — Play inside a game".

Choosing Game lists the teacher's existing Games with name and topic, single-select. The question the teacher is assigning is added to that Game as one more question in its sequence — many questions can go into the same Game, and no new Game is ever created here. Re-sending the same question does not duplicate it.

Once a Game is selected, the panel shows, read from the Game's questions:

```text
Game            Algebra Challenge
Topic           Linear Equations
Questions       5
Total Marks     30   (from the Floating Numbers marks)
Pass            70%  (21/30)
```

Pass percentage is a teacher-set field on the Game assignment; the pass mark is computed, never typed. Marks are always read live from Floating Numbers, so changing marks there changes the total.

Classes/students are chosen with the existing list and Apply behaviour; Assignment, Adventure and Course keep their current behaviour untouched.

**Timing in minutes and seconds.** The question timer and the per-line time are entered and shown as MM:SS (0:30, 1:30, 2:15) instead of whole minutes, in both Floating Numbers editing surfaces so the control is never missing on one side. Question Time and Line Time stay two separate settings. A line that has a time automatically carries the hourglass Timer Reward — it is still never placeable by hand from Game settings.

## Stage 2 — Student plays the Game

The existing student Games area is used; no second Game section is created.

A Game card shows name, topic, questions, progress (questions completed / total questions — never reward-pattern lines), score, pass percentage, status.

Opening it enters the existing Game Slate. Line 0 shows the question read-only; Game Line N is Floating Numbers Line N; rewards come from the repeating pattern; the existing universal Floating Numbers display is used on desktop, tablet and mobile. Questions are played in order.

Timer behaviour:
- Question timer is read from the question, not from Game settings.
- A line's hourglass stays attached to its line as content grows or the slate moves.
- It starts on the first symbol entered on that line, awards its bonus time to the question timer when the line is finished in time, and dissolves unawarded when it expires.

Marks use the existing marking logic. On completion the Game records questions completed, total and achieved marks, percentage, pass percentage, pass/not-passed, status and completion time, and gets its guest link through the existing link system.

## Stage 3 — Reports

The existing Reports architecture gains two activity types so it covers Assignment | Game | Adventure | Course — one framework, not four. The existing Assignment and Adventure reports are unchanged.

Game rows show Game, topic, student, questions, total marks, achieved marks, percentage, pass percentage, pass/not passed, progress, status, date.

## Technical notes

- Assignment target is added to `AssignDialog.tsx` and `src/lib/assignments/pipeline.ts` as a `game` target; the Game side reuses `slate_game_questions` (game_id, notebook_id, subsection_id, position) for the container, so no question text, marks or timing is copied.
- The Game↔class link reuses `learning_assignments`, which already has `mode` and a `game_id` column; a `pass_percentage` column is added there (plus a `game` mode value). No second marks field: totals are derived via `listGameQuestions`/`markForLine`.
- Timing stays in `notebook_subsections.floating_scoring` (`timerEnabled`, `timerSeconds`) and per-line `timerSeconds` on `FloatingLine`; only the input/display becomes MM:SS.
- Student results reuse the existing assessment progress path rather than a new scoring table; `rewardsForLine` in `src/lib/slate/pattern.ts` remains the single reward mapping.
- Reports extend `TaskMode` in `src/lib/reports/progressChart.ts` and the filter/label maps, keeping one data layer.

## Verification

Typecheck, focused tests for total-marks/pass-mark derivation, question-count progress and hourglass-only-where-timed, plus loading the assign dialog, a student Game and a class report in the preview.
