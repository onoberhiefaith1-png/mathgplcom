# Student Smartboard upgrade + Teacher Reasoning Panel

Reuse the existing Gameful-style grader (`supabase/functions/grade-line` + `_shared/mathEquivalence.ts`) and the existing `assessment_answer_keys` as the source of truth for expected lines. No new grading engine.

## 1. Force students into Presenter-Preview-only mode

Both student surfaces already use `<PresentationView role="student" />`, but the component still exposes Normal Mode chrome (aligned solution lines, floating internals) to `role="student"`. Add a strict `presenterOnly` gate.

- `src/components/smartboard/PresentationView.tsx`
  - Derive `const presenterOnly = role === "student";`
  - Wherever Normal Mode shows the aligned/correct solution rows and teacher-only floating internals (the same regions currently gated by `isTeacher`), also hide them when `presenterOnly` is true.
  - Force the "Presenter Preview" render path on for students — floating numbers only, no aligned solution, no Normal/Preview toggle chrome.
  - Keep the student input row, line navigation strip, Check button, and existing student affordances untouched.
- `src/pages/student/StudentSmartBoardPage.tsx` and `src/pages/student/AssessmentBoardPage.tsx`
  - No prop changes required beyond confirming both mount the current `PresentationView` (they already do). Remove any lingering legacy board fallback if present.

Teacher pages (`SmartBoardPage`, `TeacherAssessmentViewerPage`) keep full Normal Mode.

## 2. Silent Auto Force Check on line-leave (student)

Add a per-line silent grader that runs when the active line changes.

- In `PresentationView.tsx` (student branch), track `prevActiveLineId`. When the active line index changes or the board unmounts:
  - Read the ascii of the line just left via existing `nodesToAscii`.
  - If non-empty and not already marked correct, call the existing `grade-line` edge function with `{ assessmentId, questionId, lineId, studentAscii }`.
  - No toast, no sound, no UI feedback. Only update the internal solved-lines state that the top line strip already reads (server returns `solvedLines`/`score`).
- Manual Check button behaviour is unchanged (Mode 1 still shows feedback).

## 3. Floating-number set enforcement (Auto Force Check only)

Per the answer, this only gates the silent auto-check — Manual Check keeps its existing feedback path.

- `supabase/functions/grade-line/index.ts`
  - Accept optional `mode: "manual" | "auto"` and optional `allowedFloatingTokens: string[]` in the body schema.
  - When `mode === "auto"` and `allowedFloatingTokens` is provided: tokenise `studentAscii` into number/variable atoms; if any atom lies outside the allowed set, return `{ correct: false, verdict: "not_in_floating_set" }` and do NOT award marks. Existing equivalence path runs only when the subset check passes.
  - Manual mode ignores the constraint.
- Client passes the line's floating tokens (already available in the presenter preview data used to render the student's floating chips) alongside the auto-check call.

## 4. Teacher live student-line broadcast (reuse existing presence/sync)

Reuse `useSmartboardSync` / `class_smartboard_state` rather than adding a new channel.

- Student `PresentationView` (role="student", assessment mode): on every edit of the active line, publish `{ questionId, lineId, ascii, nodesJson }` through the existing sync hook (extend its payload — additive field, no schema change if it uses JSON state; otherwise add a nullable `live_line jsonb` column via migration with GRANTs).
- Teacher subscription reads the same channel keyed by `(assessmentId, studentId)`.

## 5. Teacher Reasoning Panel

Entry point: `src/pages/class/TeacherAssessmentViewerPage.tsx` — the existing "View Student Work" screen. Do not change the Adventure → Assessment → In Progress/Completed/Inactive → View Student Work flow.

- Add a right-edge icon button (🧠 "Mathematical Reasoning") in the existing floating bottom bar or as a right-edge rail button.
- New component `src/components/smartboard/TeacherReasoningPanel.tsx`.
  - When toggled open, wrap the `PresentationView` in a flex row: board shrinks to ~20% width, panel takes ~80%. Use a layout wrapper local to `TeacherAssessmentViewerPage.tsx` (no changes to `PresentationView`'s internals). Toggle-able open/close, state persisted in component state.
- Panel content, per selected line (defaults to the student's current active line, click any line in top strip to inspect):
  - Line number
  - Expected Line — pulled from `assessment_answer_keys.lines` matched by `(questionId, lineId)`, rendered via existing math renderer (raw ascii tokens joined, same source `grade-line` already uses).
  - Student Line — live mirror of the broadcasted ascii/nodes. Render exactly as the student wrote it (use `MathRender` / `MathTreeRender` on the raw nodes; do not normalise, reorder, or collapse whitespace).
  - Mathematically Equivalent? YES / NO — computed by calling `grade-line` in a new **dry-run** mode (`persist: false`) whenever the mirrored line changes (debounced ~300ms). Returns verdict + reason without writing `assessment_progress`.
  - Reason — verdict string from equivalence engine (`equal`, `not_equal`, `not_in_floating_set`, `parse_error`, etc.), plus the human-readable label.
  - Awarded Marks — from the student's `assessment_progress.solved_lines[questionId:lineId]` (already updated by the real auto/manual check paths).

## 6. `grade-line` dry-run mode

Extend the edge function to support the reasoning panel without corrupting student progress.

- Body: add optional `persist: boolean` (default true).
- When `persist === false`: run equivalence + floating-set logic exactly as normal, return the verdict + would-be marks, but skip the `assessment_progress` upsert.

## Data / migration

Only add a migration if `class_smartboard_state` cannot carry the per-line live payload. If needed, additive only:

```
ALTER TABLE public.class_smartboard_state ADD COLUMN IF NOT EXISTS live_line jsonb;
```

(No new table.) All existing policies/grants remain.

## Non-goals / guardrails

- Do not invent expected equations. Expected lines come strictly from `assessment_answer_keys` populated when the teacher publishes.
- Do not change student layout, chrome, or beautify their input in the reasoning mirror.
- Auto Force Check must be completely silent — no toast, sound, or focus change.
- No changes to Adventure/Assignment routing or dashboards.

## Technical file list

- Edit: `src/components/smartboard/PresentationView.tsx` (presenterOnly gate, auto-check on line-leave, live broadcast for students).
- Edit: `src/pages/class/TeacherAssessmentViewerPage.tsx` (layout split + toggle button + subscription).
- New: `src/components/smartboard/TeacherReasoningPanel.tsx`.
- Edit: `src/hooks/useSmartboardSync.ts` (carry live-line payload).
- Edit: `supabase/functions/grade-line/index.ts` (`mode`, `allowedFloatingTokens`, `persist` flag).
- Optional migration: add `class_smartboard_state.live_line jsonb`.
