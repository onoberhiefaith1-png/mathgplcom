## What I checked first

- `supabase/functions/grade-line/index.ts` in this project vs Gameful's: this project's version is Gameful's file **plus** `mode` (manual/auto), `allowedFloatingTokens` floating-set enforcement and `persist` (dry-run). Same shared engine `_shared/mathEquivalence.ts`, same `equivalent()` call, same verdict/marks/progress shape.
- Gameful has **no** `assessment_board_state` / `assessment_question_board_state` and no per-student assessment board session at all (searched the project — 0 matches). Its only board mirroring is the class-wide `class_smartboard_state` teacher board. So items 2–4 of the request are already present here, and item 1 (student board sync) cannot be literally copied from Gameful — this project's session layer is newer than Gameful's.
- The sync layer that exists here: `useAssessmentBoardSession.ts` (broadcast on channel `assessment-board-<assessmentId>-<studentId>[-<questionId>]`, debounced durable upsert) plus a separate live snapshot broadcast on `assessment-live-<assessmentId>-<studentId>` consumed by `TeacherReasoningPanel`. Student and teacher pages pass matching `boardStudentId`; the teacher scopes `boardQuestionId` from the `?q=` search param.

I have **not** confirmed why sync fails in practice, so step 1 is diagnosis, not a guessed fix.

## Plan

### 1. Reproduce and diagnose (first, before any edit)
Drive two Playwright sessions against the running app — student on `/student/.../assessment board` and teacher on the assessment viewer — typing on the student board and capturing: channel names actually subscribed, broadcast sends, and what the teacher board receives. Record which of these is true:
- channel-name mismatch (teacher opened without `?q=` while the student board is per-question),
- the publish effect never firing for some mutation classes,
- realtime private-channel auth/join failure,
- teacher side receiving but not applying the snapshot.

### 2. Make the session scope match on both sides
If the diagnosis confirms a scope mismatch, make teacher and student resolve the same `questionId` (teacher falls back to the student's currently active question from `assessment_question_board_state` instead of `null`) so both always join one channel.

### 3. Cover every mutation in the publish path
Audit `PresentationView.tsx` for board mutations that bypass React state (drag/rearrange/delete paths that write refs or mutate in place) and ensure each ends in a state update that reaches the publish effect at ~line 3115, so writing, dragging, deleting, rearranging, editing and creating a line all push. Add a low-frequency safety re-publish so a missed change self-heals rather than leaving the teacher stale.

### 4. Self-healing realtime join
Apply the same retry pattern already used in `useSmartboardSync.ts` (`CHANNEL_ERROR`/`TIMED_OUT` → re-auth → resubscribe once) to `useAssessmentBoardSession` and to the `assessment-live-*` channel, so a cold token doesn't permanently kill mirroring.

### 5. Silent grading triggers
Keep the existing silent grader (`silentAutoCheckLine`) and its logic untouched. Only widen when it fires: currently only on `activeLineIdx` change. Add a debounced idle trigger on a settled, non-dangling line so a line completed without moving off it is still graded silently. No toasts, no focus change; Check stays as student-facing feedback only.

### 6. Leave unchanged
`TeacherReasoningPanel.tsx`, the equivalence engine, `grade-line`'s algorithm, marks/score computation, and all UI layout.

### 7. Verify
Re-run the two-session Playwright check: type/drag/delete on the student board, confirm the teacher board mirrors within ~a second, confirm the reasoning panel shows expected vs student line with an equivalence verdict, and confirm `assessment_progress.score` increments without any student interaction.

## Technical notes
- No schema changes expected; no destructive migrations. If step 1 shows a missing grant/RLS on the board-state tables, the fix would be an additive policy migration only.
- No file is copied from Gameful, because the relevant Gameful files either don't exist there (board session) or are already a strict subset of this project's (`grade-line`, `mathEquivalence`).
