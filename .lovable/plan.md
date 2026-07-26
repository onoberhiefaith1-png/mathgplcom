## What I verified first

- The two tables that carry the shared student/teacher board (`assessment_board_state`, `assessment_question_board_state`) have **zero table privileges granted** to `authenticated` / `service_role`. Their row-level rules are correct, but with no grants every read and write from the app is rejected outright. Both tables contain **0 rows**, while grading progress rows do exist — so the board has never once persisted.
- The client code that saves the board (`useAssessmentBoardSession.push`) fires the save and **ignores the returned error**, which is why this failed invisibly instead of showing a message.
- Check Line already calls the shared equivalence grader, but it is wrapped in **legacy pre-checks that reject the line before grading**: an "⚠ Line N incomplete" guard, an "Incomplete expression … ends on an operator" guard, and a guess-the-row matcher that can pick the wrong written row and then report a mismatch. These are the legacy errors being seen.
- Silent auto-grading exists and calls the same function, but it duplicates that same row-guessing logic and silently aborts on the same guards.

## Fix 1 — Real-time synchronization

1. Migration (additive, no schema change): grant the missing table privileges on `assessment_board_state` and `assessment_question_board_state` to `authenticated` and `service_role` so the existing access rules can actually take effect.
2. In the board session hook, stop discarding save/load errors: surface them to the console and retry once, so a future permission or network failure is visible instead of silent.
3. Publish coverage: keep the existing change-driven publish, and keep the periodic safety re-publish that catches in-place mutations (drag, delete, rearrange, floating-number drops) which don't create new state identities. Reduce its interval so those actions land near-instantly rather than up to a second late.
4. Ensure the student's first snapshot is published as soon as the channel is ready (teacher joining late immediately gets the full board rather than waiting for the next edit).

## Fix 2 — Check Line uses only the equivalence engine

Rewrite the body of the manual check so it:

- resolves the student's current line, then sends it to the same `grade-line` function used by the Reasoning panel;
- **removes** the "line incomplete", "no ink found" and "ends on an operator" pre-checks — the server verdict is the only judge;
- keeps only genuinely empty input as a no-op (nothing to grade);
- reports the result purely from the server verdict (equivalent → marks awarded; not equivalent → the grader's reason).

## Fix 3 — Silent auto-grading on one shared pipeline

- Extract the line-resolution + grader call into **one shared function** used by both manual Check and the silent grader; the only difference becomes the mode flag and whether feedback is shown.
- Keep both existing triggers (leaving a line, and pausing on a line) so marks and the score counter update in the background without pressing Check.

## Technical notes

- Files touched: one additive SQL migration; `src/hooks/useAssessmentBoardSession.ts`; `src/components/smartboard/PresentationView.tsx`.
- Not touched: `TeacherReasoningPanel.tsx`, the `grade-line` edge function, and `_shared/mathEquivalence.ts` — the working engine stays exactly as is; the other features are wired into it.
