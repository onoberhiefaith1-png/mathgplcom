## Technical notes

No schema change. Everything below reads `course_exercise_questions` as the single source of truth.

**Verified state.** `course_exercise_questions` holds two rows. Block `b495f550…` ("Practice Set A") → subsection `191383b3…`, section `63ba254a…`, notebook `70f855ee…`; none of those three rows exist any more, so `compileSectionQuestions(section_id)` returns nothing and the page renders its empty state. Block `fc60456b…` → subsection `63aac18d…` with 17 floating lines, which resolves fine.

**`src/lib/courses/exerciseBoard.ts`**
- `compileExerciseBoard(blockId)` returns one entry per *link*, in `position` order, each `{ linkId, questionId, label, marks, payload | null, missing }` — never a silently shortened array. `payload` is the compiled `QuestionPayload` when resolvable; `missing: true` when it is not.
- Resolution order per link: (1) `subsection_id` inside `compileSectionQuestions(section_id)` as today; (2) if the section row is gone, look up the notebook section by `stable_key = question_key` and match the subsection by `doc_key`, then by problem text equal to `label`; (3) otherwise `missing`.
- Marks come from the compiled lines when resolvable, else the stored `total_marks`, so the card total never blanks out.
- Keep `syncCourseExerciseAssessments` / `findCourseExerciseAssessmentRaw` unchanged for the class path, but have the class path fall back to `compileExerciseBoard` when the hidden assessment has no questions, so the class list and the builder list agree.

**`src/components/coursebuilder/SectionsEditor.tsx`**
- Remove the `totalMarks` number input; render **Number of questions** and **Total marks** as calculated read-only values from `qs` (`qs.length`, `sum(total_marks)`). Keep **Pass mark %** editable. Stop writing `config.totalMarks`; readers use the derived sum (the stale stored value is ignored, not migrated).
- **View Exercise** always enabled when `courseId` is known; with zero links the target page shows the "link a question" guidance.

**`src/pages/class/TeacherExerciseQuestionsPage.tsx`**
- Render from the new list shape: heading = card name, subline = `N questions · M marks · pass X%`, then numbered rows with marks, a video badge, **Add Video**, and a disabled flagged row for `missing` links plus a **Remove link** action (deletes only that `course_exercise_questions` row).
- Selecting a row keeps today's `?q=<questionId>` behaviour and builds the board from that one question only, so each question opens its own Smartboard content.

**`src/pages/student/StudentExerciseQuestionsPage.tsx`** — same list source, so a student sees the same questions and count; `missing` rows are omitted from the student list and excluded from the pass-mark total.

**Tests** — extend `src/lib/courses/__tests__/exerciseBoard.test.ts`: count/marks roll-up from links, `position` ordering, a link whose section is gone resolving via `question_key` + `doc_key`, and an unresolvable link surfacing as `missing` rather than collapsing the list.
