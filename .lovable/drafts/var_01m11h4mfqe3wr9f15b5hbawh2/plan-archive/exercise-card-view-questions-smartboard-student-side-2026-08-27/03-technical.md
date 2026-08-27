## Technical notes

No schema change is needed: exercise questions are already linked rows, and the solving board already records marks.

**New helper** `src/lib/courses/exerciseBoard.ts`
- `ensureCourseExerciseAssessment({ classId, courseId, blockId })` — finds or creates one assessment row for that exercise card in the class the course was assigned to, compiled from the card's linked lesson-note questions with the existing `compileSectionQuestions`, stored with `kind: "course_exercise"` and a `course_block_id` marker in the existing question payload/meta so it is found again rather than duplicated.
- Reuses the same record shape as the Floating test board helper, so the marking, grade lines and answer keys are the existing engine.

**New student pages/routes**
- `src/pages/student/StudentExerciseQuestionsPage.tsx` at `/student/class/$classId/course/$courseId/exercise/$blockId` — the question list: label, marks, and the student's per-question status/score read from `assessment_progress` / `assessment_question_board_state`. Membership check mirrors the other student pages.
- Selecting a question navigates to the existing student board: `/student/class/$classId/assessment/$assessmentId?q=<questionId>&source=course&returnTo=<list>` — i.e. `AssessmentBoardPage`, which renders only `PresentationView` for `role="student"`; no `TeacherEvaluationPanel` is imported there, so no teacher tooling can appear.

**Student View change** (`src/components/coursebuilder/StudentView.tsx`)
- Exercise block gains a `View Questions` button plus `n questions solved / total marks`. The component takes an optional `onOpenExercise?: (blockId: string) => void`; the Course Builder preview passes nothing (button rendered disabled), `StudentCourseRunnerPage` passes a navigate handler. Locked exercises keep their existing lock behaviour and the action is disabled.

**List hygiene**
- Assessments created for course exercises are filtered out of the assignment lists that already filter by `kind` (`StudentAssignmentPage`, `StudentAllAssignmentsPage`, class assignment lists), so they only ever appear through the Exercise Card.

**Progress**
- Existing `markCourseProgress` is called when a card's earned marks reach its pass mark, keeping the locked/unlocked pathway behaviour intact. Real-time marking, timers and board sync are untouched.

**Tests**
- Unit tests for `ensureCourseExerciseAssessment` idempotency (no duplicate assessment per card) and for the earned/total + pass-mark roll-up used by the card and the list.
