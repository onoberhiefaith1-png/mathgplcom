## The work

### 1. Make View Exercise open immediately
- Stop blocking the page on the class-wide exercise re-sync; the list renders from the card's own saved links first, and the sync runs afterwards in the background.
- Resolve the card's question links **in parallel**, compiling each source lesson note once and reusing it for every link that shares it.
- Fetch the card's video flags alongside, not before, the list.
- Show the question list as soon as the links are known, filling marks per question as they resolve.

### 2. Fix the video save
- The video table is staged as an additive change on this draft; it becomes real in the project **when you accept this draft**. Until then any save will report the missing-table error — that is the whole cause, not a code bug.
- Saving is switched to key strictly on `(exercise card, question)` so re-saving updates the same record rather than creating a second one.
- If the record cannot be written, the editor reports the real reason instead of appearing to succeed.

### 3. Load the saved video with the question
- The question's video is fetched together with opening the question, so the Test Smartboard mounts with the video already attached.
- Reopening or refreshing the question shows the saved video with no re-upload.
- The video is always the one belonging to the opened question.

### 4. Layout, roles, sync — kept as-is
- The three-position control stays, with **Smartboard** as the default position; the board is mounted once, so switching position never restarts the test or clears the floating-number state.
- Teacher testing/evaluation controls remain teacher-only; the student surface gets question + video + solving board, nothing else.
- No new sync layer: the video is content belonging to the question, delivered through the existing question configuration and the existing teacher/student board synchronisation.
- Adventure, Assignment, and exercise-assignment logic are untouched.

## Technical notes
- `src/lib/courses/exerciseBoard.ts`: `resolveLinks` becomes concurrent with a shared per-section compile cache; `loadExerciseCard` no longer awaits `syncCourseExerciseAssessments`.
- `src/pages/class/TeacherExerciseQuestionsPage.tsx`: sync moved off the critical path, video config loaded with the active question, list rendered before marks resolve.
- `src/lib/courses/questionVideoStore.ts`: upsert conflict target and error surfacing.
- Staged migration `exercise_question_videos` already carries the grants and owner-write / signed-in-read policies; no schema change runs now.
- Tests: link resolution order/count under a missing source note, and the parallel compile cache doing one compile per section.
