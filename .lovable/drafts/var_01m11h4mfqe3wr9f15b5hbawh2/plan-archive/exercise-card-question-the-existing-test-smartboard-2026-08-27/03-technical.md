## Technical detail

Diagnosis: `PresentationView` sets `assessmentMode = !!source && !!assessmentId` (line 396). On the class-free course-builder route `assessmentId` is passed as `null`, so it falls to `useNotebook(notebookId)` with no notebook id and renders the "Loading notebook…" branch forever.

Changes:

1. **New helper** `ensureExerciseQuestionTestBoard(blockId, questionId)` in `src/lib/courses/exerciseBoard.ts`, modelled exactly on `openFloatingTestBoard` in `src/lib/floating/testBoard.ts`:
   - reuse the same hidden per-teacher `floating_test` class (export `ensureTestClass` from `testBoard.ts` rather than duplicating it),
   - one reusable hidden assessment keyed by `question_key = <blockId>:<questionId>`, kind `floating_test`,
   - write its answer key from the question's own compiled lines (already available via `loadExerciseCard` payloads),
   - return `{ assessmentId, classId, question, total, title, sittingId }`.

2. **`src/pages/class/TeacherExerciseQuestionsPage.tsx`** — replace the current board branch with the same shell as `FloatingTestBoardPage`:
   - resolve the question through the new helper, then mount one `PresentationView` with `source`, `assessmentId`, `classId`, `workspace="floating_test"`, `boardStudentId={uid}`, `boardQuestionId={questionId}`, `testMode`,
   - key the board on `buildBoardScope(...)` + `sittingId` + restart counter, and `clearBoardScope` on entry and unmount,
   - right pane `TeacherEvaluationPanel` (with `localLive`, fullscreen toggle, wrapped in `RecoveryBoundary`),
   - bottom bar: Back / Viewing: Test / Evaluation / marks / Restart / Exit test,
   - drop the `videoFor !== activeQuestionId` gate so the board mounts without waiting on video; keep the Add Video button and `QuestionVideoEditor` wiring as-is.

3. No changes to grading, floating numbers, sync, `ThreeViewFrame`, or the student side.

Verification: unit test that the helper returns one stable assessment per `(blockId, questionId)` and that its answer key matches the card's linked question lines; then open a card question in the preview and confirm the board paints with the question and Evaluation panel.
