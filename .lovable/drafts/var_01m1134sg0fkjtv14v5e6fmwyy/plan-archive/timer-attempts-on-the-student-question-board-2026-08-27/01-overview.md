# Timer attempts on the student question board

A second, temporary layer on top of the marking system that already works. Nothing about grading, the numbered circles, or awarded marks changes.

Confirmed from the code before planning:
- The student board already keeps permanent achievement in `assessment_progress.solved_lines` (`questionId:lineId` → marks) plus `score`, seeded on open and mirrored live. Awarding is already guarded: an already-solved slot is never re-awarded ("Already marked").
- The top-of-board tracker already exists in `PresentationView` — one numbered circle per guided line, green tick when solved, plain number when not attempted. This is the row we keep untouched.
- Board work is already per question: `assessment_question_board_state` is keyed by assessment × student × question, so each question is its own workspace. The timer therefore lives at the same grain.
- Assignments have `due_at` today, but no timer flag and no start/unlock time. Assignment Dashboard has no Timer control.

## What gets built

1. Teacher control on the Assignment Dashboard: Timer ON / OFF, plus optional Start time and End time for the assignment.
2. When Timer is OFF: the student experience is byte-for-byte today's experience. No second row, no timer, no Reset.
3. When Timer is ON, per question: an elapsed-time readout (HH:MM:SS, hours never converted to days), a second numbered-circle row for the current attempt, and a Reset button beside the existing − 100% + controls.
4. Timer starts on the student's first real input on that question's board, pauses when they leave, resumes automatically on return — no extra click.
5. Reset clears that question's board and the current attempt row only. Permanent circles, awarded marks, score and Best Time survive.
6. Best Time per question = shortest verified successful attempt. Ranking uses stored milliseconds; the display shows HH:MM:SS. Equal stored times share a position, and the next student takes the skipped position (1st, 1st, 3rd).
7. Teacher test sittings (`testMode`) record nothing — same as today.
