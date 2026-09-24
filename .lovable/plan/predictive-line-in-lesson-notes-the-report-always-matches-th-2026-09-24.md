# Predictive Line in Lesson Notes + the report always matches the mark

## What is happening now
- The teacher's Evaluation panel (the one open on your lesson note test board) shows **Expected line**, **Student line (live)**, and a verdict. The verdict is simply the **last message the student's board sent**.
- The mark itself is correct. It is kept permanently, and the panel reads it from saved progress, so **2/2** is right.
- After a line is awarded, the board can still send later background checks. These are the reconciliation check and retries. If one of them fails or times out, the board sends "Could not evaluate — the marking engine did not answer. Retrying." That message replaces the earlier "Equivalent", even though the line is already marked 2/2.
- The Game already has a Predictive Line engine. It is shared maths with no screen of its own. The lesson note panel doesn't use it yet.

## What changes

### 1. One line result drives both the mark and the report
- For each question and line, the panel keeps one result: the status, the exact student line it was worked out for, and the marks.
- The status is one of: **Equivalent / Not equivalent / Incomplete / Pending**.
- An awarded line (marks above 0 in saved progress) always shows **Equivalent** with a green tick. A later failure or retry message can never change that.
- A "could not evaluate" message is only shown when there is no result yet for that exact line. Even then it reads as **Pending** ("checking…"), never as an error.
- The status is worked out again only when the student's line actually changes, or when they move to another line. Line 1 stays "Equivalent — 2/2" once the student moves on to Line 2.

### 2. The board stops sending false failures
- If a background check fails on a line that was already awarded or already proved equivalent, the board sends nothing. The earlier result stands.
- The backup AI explanation can add wording only. It can never overturn an equivalence the maths engine has proved.

### 3. Add the Predicted Line row
- A new **Predicted line** row sits between Expected line and Student line (live).
- It uses the same Predictive Line engine as the Game, fed with the expected line and this line's Floating Numbers. It shows the student's work so far plus the shortest valid way to finish the line.
- When the line is complete and equivalent, it shows the finished line. When there is no valid way to finish it, it shows "No valid route".
- The maths is displayed cleanly. The panel never shows internal codes: the small grey engine code line under the verdict is removed.

## Not changing
How marks are awarded, the marking service, how students write, the Game panel, Vault, and rewards.

## Technical notes
- `TeacherEvaluationPanel.tsx`:
  - Store checks per `questionId:lineId` in a map, instead of the single `lastCheck`.
  - Derive `status` from `awardedMarks > 0` first, then from a non-error check whose `studentAscii` matches the current student line. Treat `verdict:"error"` as `pending` and never let it replace a stored `equal`.
  - Add a Predicted line `LineViewer` using `routeMapFor` / `predict` from `src/lib/predictive/predictiveLine.ts` with `expectedAscii` and `allowedTokens`.
  - Remove the `diagnosis.code` monospace line.
- `PresentationView.tsx` (both "Could not evaluate" broadcast paths, around lines 4775 and 4913): skip the broadcast when the slot is in `solvedSlots`, or when `predictiveAwardedRef` / the awarded-expression ref already holds this line.
- Tests:
  - an error after an equal result keeps the status at Equivalent;
  - an awarded line shows Equivalent after reload;
  - changing the line resets the status to Pending;
  - the predicted line for `3x/3 = 15/3` and a partial input;
  - an earlier line's result is kept after moving to the next line.
