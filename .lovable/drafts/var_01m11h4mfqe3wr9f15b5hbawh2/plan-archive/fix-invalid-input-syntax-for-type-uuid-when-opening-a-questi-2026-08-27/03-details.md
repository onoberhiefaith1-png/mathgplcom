## What changes

One hidden test container per exercise question, identified by the question's own id — a real uuid — and tagged with its own kind so it can never be confused with the Floating Numbers test board for the same lesson-note question.

Behaviour after the fix:
- Selecting a question on an Exercise Card opens the existing Test Smartboard immediately, with that question loaded.
- Grading, evaluation, floating numbers, marks, Restart and Exit test all stay exactly as they are.
- Repeated opens reuse the same container; nothing is recorded and nothing is ever visible to students.
- No schema change is needed, so this works right away in this draft.

## Technical detail

`src/lib/courses/exerciseBoard.ts` — `openExerciseQuestionTestBoard`:
- Replace `questionKey = ${blockId}:${questionId}` with `questionKey = questionId`.
- Use a dedicated kind constant `COURSE_EXERCISE_TEST_KIND = "course_exercise_test"` for the lookup, insert and duplicate cleanup, instead of reusing `floating_test` (which keys on the subsection id and would otherwise collide).
- Guard the entry: if `questionId` is not a uuid, fail with a readable message instead of letting the database raise.
- Keep the rest untouched: answer-key write, progress clear, fresh `sittingId`, single-flight map (its in-memory key may stay `blockId:questionId`).

`src/pages/class/TeacherExerciseQuestionsPage.tsx` — surface any thrown message as-is (already does) so a real failure reads plainly rather than as raw database text.

Tests: extend `src/lib/courses/__tests__/exerciseQuestionTestBoard.test.ts` to assert the stored key is a bare uuid, the new kind is used, one container is reused across repeated opens, and the answer key stays scoped to the selected question.
