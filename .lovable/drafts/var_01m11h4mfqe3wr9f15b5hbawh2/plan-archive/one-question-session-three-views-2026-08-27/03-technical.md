## Technical detail

**Store (staged additive migration).** The existing staged `public.exercise_question_videos` file gains a `segments jsonb NOT NULL DEFAULT '[]'` column holding the ordered list `{ key, label, start, end, required }`; the older end-only `checkpoints` map stays for backwards compatibility and is read as a fallback. Keys remain `intro`, `line:<lineId>`, `conclusion`, unique per `(block_id, question_id)`, RLS: owner writes, signed-in learners read. It applies to the project when this draft is accepted — until then the teacher-facing error stays honest rather than a fake success.

**Segment model** (`src/lib/courses/questionVideo.ts`): add `segmentsFor(lines, cfg)` returning explicit `{ start, end }` per section, preferring stored `segments`, else deriving from `checkpoints`, else an even split; clamp inside `[0, duration]` and keep order. `sectionForLine`, `nextSection`, `prevSection`, `shouldAutoPlay` keep their current contracts. Unit tests cover explicit segments, legacy checkpoints, overlap clamping and gap handling.

**Editor** (`QuestionVideoEditor.tsx`): per-segment `Start` and `End` fields, each with its own **Set at playhead**, plus mm:ss typing; required badge on mathematical lines; Introduction/Conclusion toggles. Save writes both `segments` and the derived `checkpoints`, and reports the real error on failure.

**One player, three views** (`ThreeViewFrame.tsx` + `QuestionVideoPane.tsx`): the pane is always mounted; visibility is CSS only (`hidden`/sized container) so hiding never unmounts the `<video>` and audio continues. The pane keeps the playhead in a ref across view changes, and the switch handler only sets the view state — it never seeks, pauses, or remounts. Board children are already mounted once and stay untouched.

**Play Screen gate**: `TeacherExerciseQuestionsPage` / student board wrapper render the switcher and the Play Screen action only when `videoReady(config)`; otherwise the existing Test Smartboard renders unchanged, with just **Questions** and **Add Video** in the chrome.

**Assignment completion** (`src/lib/assessments/lessonProgress.ts`): replace `anyCompleted` with `completedCount` and mark a student `completed` only when every assessment in the card has a `completed` row (contribution mode unchanged). `inactive` / `in_progress` behaviour is untouched. Tests: 1-of-3 → in progress/inactive, 3-of-3 → completed.

**Join Live**: for a student whose status is `in_progress`, the viewer enters live mode and mounts the board immediately from the last persisted question row while the first broadcast frame arrives; `TeacherEvaluationPanel`'s "waiting for the student's board" copy becomes a non-blocking "connecting to the live board…" hint that clears on the first frame, and never gates rendering.

**View Student Work per question**: the question strip in the teacher assessment/exercise question list renders a `View Student Work` action on every row regardless of a recorded best time, deep-linking with `?q=<questionId>&mode=work`; empty or reset boards render the same default state the student sees.

**Performance**: keep the two-phase load already in place (links-only shell paints first, lesson notes resolved in parallel with one compile per note, class sync off the critical path) and fetch the question's video config in the same parallel phase so opening a question never adds a round trip.

Out of scope: no change to Exercise Card / Adventure / Assignment relationships, no change to the marking, floating-number or grading engines.
