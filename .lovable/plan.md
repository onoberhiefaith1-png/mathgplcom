## Problem

On the teacher's student-viewer the top strip shows `0 / 45` and no line chips marked, while the student's own board shows `21 / 45` with lines 1–7 marked.

Confirmed cause (verified in the database and the code):
- The student's row in `assessment_progress` for this assessment holds `score = 21` and 7 solved line slots — the data is correct and the teacher's account is allowed to read it (an owner read policy exists).
- `PresentationView.tsx` seeds its grading state (`solvedSlots`, `assessScore`) by querying `assessment_progress` for **the currently logged-in user's id** (`auth.getUser()`), not for the student whose board is being viewed. On the teacher's screen that lookup finds no row, so the score renders as `0 / 45` and every line chip stays unmarked.
- The realtime subscription filters only on `assessment_id`, with no student check, so it can also apply the wrong person's row when several students are graded during a class.

## Fix

In `src/components/smartboard/PresentationView.tsx`:

1. Resolve the progress owner once: use `boardStudentId` when present (teacher viewing a student), otherwise the signed-in user's id (student on their own board).
2. Seed `solvedSlots` / `assessScore` from `assessment_progress` for that resolved id, and re-run when it changes.
3. In the realtime handler, ignore any payload whose `student_id` differs from the resolved id, so the teacher only ever mirrors the student they opened.

No schema changes, no policy changes, no writes from the teacher side — the teacher view stays read-only and simply mirrors the student's stored marks. The existing top strip and line-chip rendering already derive from `solvedSlots`, so both the `x / 45` score and the marked lines 1–7 will appear once the correct row is loaded.

## Verification

Open the same teacher viewer route for this student and confirm the header shows `21 / 45` with lines 1–7 marked, and that a fresh mark on the student's board updates the teacher's strip live.
