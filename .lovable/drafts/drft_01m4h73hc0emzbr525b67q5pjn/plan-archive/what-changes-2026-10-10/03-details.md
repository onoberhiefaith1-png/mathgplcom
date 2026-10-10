**5. Academia Practice: calm and repeatable**
- No completion screen in Practice. The "Practice complete" result card added earlier will be removed.
- When the last line is solved, the board quietly resets so the student can solve it again, as many times as they like. Each attempt is still saved.
- A small **Prev / Next** pair sits at the top of the board, so students can move to the previous or next activity's Practice at any time without going back to the Session. Each button is greyed out at the start or end of the list.
- The same applies in the offline Academia app.

## Technical details
- Score: in `ImaginePlayPage` (top bar and the `GameCompletionScene` summary), use `runtime.question.totalMarks` and the current question's earned marks instead of the `useGameRuntime` sums across all boards. Keep the whole-game total only for internal progress.
- Evaluation: today `GameEvaluationPanel` only renders in `testMode`. It will render when the account's role (from the existing roles/capability helper) is teacher, school owner or platform admin, and never for student or assessor accounts.
- Flow per game: `completionFlow` already lives in each game's settings; the Academia Play launch (`?academia=`) reads it from that game.
- Academia Play chain: work out the next activity from the Session's activity order (`academia_activities.position`). Continue goes to the next activity's Play route; the last one goes back to the Session.
- Practice: in `AssessmentBoardPage` (Academia mode) and `OfflineActivity`, remove the result card, save the attempt and reset the board when it is complete, and add a compact Prev/Next header built from the same activity order.
- Guest Session links keep their current flow for now (they use the older player).
