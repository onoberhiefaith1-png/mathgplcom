## Teacher: Assignment Dashboard

A new Timer card above the student status panel:
- `Timer: ON / OFF` (default OFF, applies to every question in the assignment).
- `Opens at` and `Closes at` date-times, both optional.

Before Opens at: students see the assignment on their dashboard but cannot enter it — locked, with the unlock time shown. After Closes at: the board opens read-only; results stay visible to the teacher. With neither set, behaviour is exactly today's (`due_at` keeps its current meaning).

When Timer is ON, the dashboard also shows a Best Time leaderboard per question: student, best time HH:MM:SS, position. Ties on the stored millisecond value share a position and the next student takes the skipped place (1st, 1st, 3rd).

## Student: one question, one timer

Each question already opens its own board and returns to the assignment card — that stays. Per question, when the timer is on:

- Elapsed time and Best Time sit in the board chrome next to the existing score.
- Reset joins the existing `−  100%  +` control group.
- The attempt row appears directly under the existing line row, same numbered-circle component, same green tick treatment. A line never attempted stays a plain number.

Timer lifecycle: `00:00:00` on open; starts at the first real input on that question's board; accumulates active working time; pauses on leaving, tab hide or unload; resumes automatically on return. Leaving never clears board work, the attempt row, or permanent marks.

Marking: unchanged. Every check still goes through the existing engine. On a correct line the attempt row ticks; the permanent row ticks and marks are awarded only if that line was not already awarded. No duplicate awards, no second grading path.

Reset: clears the question's board state and the current attempt (row + elapsed time), creates attempt n+1 at `00:00:00`, and leaves `assessment_progress`, the permanent row and Best Time untouched.

Completion: when every guided line of the question is confirmed correct within the current attempt, that attempt is marked successful and its duration recorded. Best Time becomes the minimum successful duration and only moves when a faster verified attempt happens. Students can keep attempting until Closes at to improve it.

Teacher testing (`testMode`) stays as it is: no attempt rows, no timers recorded, nothing persisted.
