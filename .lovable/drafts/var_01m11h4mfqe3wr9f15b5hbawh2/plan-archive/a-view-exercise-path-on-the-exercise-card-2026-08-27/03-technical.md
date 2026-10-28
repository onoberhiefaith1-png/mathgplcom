## Technical notes

No schema change. Question links and the video table already exist.

**Card summary + button** — `src/components/coursebuilder/SectionsEditor.tsx`
- The exercise branch already has `qs` (the linked `CourseExerciseQuestion` rows). Show `qs.length` questions and the sum of their `total_marks` as a read-only line, plus a **View exercise** button that navigates to the new route. Disabled with a hint when `qs.length === 0`.
- No change to the `totalMarks` / `passMark` inputs.

**New course-scoped teacher route** (class-free)
- `src/routes/courses/$courseId/exercise/$blockId/index.tsx` → renders `TeacherExerciseQuestionsPage`, with its own `head()` metadata and `robots: noindex`.
- `TeacherExerciseQuestionsPage` currently derives everything from `classId` via `syncCourseExerciseAssessments` / `findCourseExerciseAssessmentRaw`. Make `classId` optional: when absent, build the question payload directly from the card's links with the existing `compileExercise` path in `src/lib/courses/exerciseBoard.ts` (exported as `compileExerciseBoard(blockId)` returning `{ questions, answerKey, total }`), and pass `assessmentId={null}` / `classId={null}` to `PresentationView` in `testMode`. That is exactly the class-free testing surface the teacher already uses; no hidden assessment is created from the builder.
- The class-scoped route `/teaching-hub/classes/$classId/courses/$courseId/exercises` and its behaviour stay as they are.

**Add Video** — unchanged: `QuestionVideoEditor` + `loadQuestionVideo` / `saveQuestionVideo` are keyed by `block_id` + `question_id`, so a video attached from the builder is the same record the class view and the student board read.

**Ownership** — the page loads the course tree and only renders the board when the signed-in user owns the course; otherwise it shows a short "not yours" message.

**Tests** — a unit test for the card summary roll-up (count + marks from links) and one for `compileExerciseBoard` returning questions in card position order.
