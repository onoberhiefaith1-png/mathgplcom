# One Question Session, three views

The question owns the video. The Smartboard and the video are two visual layers of a single session, and the three controls at the top only change which layers are visible.

What is confirmed today:

- The question video store is staged but **not yet live** in this draft's database (`exercise_question_videos` does not exist yet), which is exactly why saving reports "the question video store isn't available on this preview yet". Nothing is faking success — the store becomes live when this draft is accepted.
- The three-view frame currently **unmounts the video** when you switch to Smartboard-only (`view === "board"` hides the pane by removing it from the layout branch), so audio stops and the position is lost. This breaks the "hidden is not stopped" rule.
- Assignment completion is currently `anyCompleted`: one finished question marks the whole card **Completed**. This is the completion bug.
- The teacher live view resolves the followed question from the student broadcast, but the evaluation panel still shows "waiting for the student's board…" until a frame arrives, which reads as waiting even for an IN PROGRESS student.

## What gets built

1. **Video saves for real.** The staged store gains explicit segments; saving persists against `(exercise card, question)` and survives refresh, reopen and role switch. No success toast unless the row is written.
2. **One video, start/end markers.** The uploaded file is never split. Each segment stores `label`, `start`, `end`, required flag; **Set at playhead** writes the current playback position into whichever field you're setting.
3. **One player, three views.** The video element is mounted once for the session and only hidden with CSS. Switching Main → Split → Video never restarts it, never resets the board, never creates a second session.
4. **Play Screen gate.** The view switcher and Play Screen only appear once a saved video exists for that question; before that the Test Smartboard looks exactly as it does now.
5. **Teacher vs student.** Same session plumbing, role-specific chrome: evaluation/marking stays teacher-only.
6. **Join Live is immediate** for an IN PROGRESS student, and **View Student Work** appears on every question row whether or not a best time exists.
7. **Assignment card Completed** only when every question in the card is completed.

Exercise Card, Adventure and Assignment stay independent destinations; nothing in this change touches their relationships.
