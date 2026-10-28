## Technical notes

**Storage of the video.** Reuse the existing private `course-media` bucket and `uploadCourseMedia` / `courseMediaUrl` in `src/lib/courses/media.ts` (per-user folders, signed display URLs). One file per question; replacing it overwrites the record's path.

**New table** (staged as an additive migration; it applies when this draft is accepted, so the video features cannot be exercised in the draft preview until then):

`public.exercise_question_videos`
- `id uuid pk`, `block_id uuid` → `course_blocks`, `question_id text` (the lesson-note subsection id used everywhere as `question.id`), `owner_id uuid`
- `video_path text`, `duration numeric`
- `checkpoints jsonb` — ordered `{ key, endsAt }` list keyed by `intro`, `line:<lineId>`, `conclusion`
- `intro_enabled bool`, `conclusion_enabled bool`, timestamps
- unique `(block_id, question_id)`
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`, `ALL` to `service_role`; RLS: owner (course/class owner) writes, class members of a class the course is assigned to read.

**New pure module** `src/lib/courses/questionVideo.ts` — no React, fully unit-tested:
- `sectionsFor(lines, cfg)` → ordered sections with `{ key, label, start, end, required }`, defaults filled and clamped in order.
- `sectionForLine(sections, lineId)`, `nextSection` / `prevSection`.
- `shouldAutoPlay({ lineCompleted })` implementing the replay rule.
- mm:ss parse/format reused from the existing `fmtClock` / `parseClock` helpers in `src/lib/games/timerVideo.ts`.

**New components**
- `src/components/coursebuilder/QuestionVideoEditor.tsx` — upload, scrubber, per-section "Set at playhead", required/optional badges, enable toggles for Introduction and Conclusion. Opened from an **Add Video** action in the Test Smartboard chrome.
- `src/components/smartboard/QuestionVideoPane.tsx` — the player: one `<video>` element, seeks and pauses per the rules above, plus Previous / Next / Replay / Back to my line.
- `src/components/smartboard/ThreeViewFrame.tsx` — the Left | Middle | Right switch and layout wrapper. Persisted per device in `localStorage`.

**Wiring into the existing board.** `PresentationView` already holds the single line cursor (`activeLineIdx` over `guidedLines`, both Floating Numbers and Present drive it) and the earned-marks map (`solvedSlots` keyed `${questionId}:${lineId}`). Add two optional props — a `videoConfig` and an `onLineContext` reporter — so the pane can read the current `lineId` and its completion without any change to grading, sync or navigation logic. When no config is passed the component renders exactly as now.

**Teacher View route.** New `src/routes/teaching-hub/classes/$classId/courses/$courseId/exercise/$blockId/index.tsx` plus `src/pages/class/TeacherExerciseQuestionsPage.tsx`, reusing `findCourseExerciseAssessment` / `ensureCourseExerciseAssessment` from `src/lib/courses/exerciseBoard.ts` for the question list, and opening the existing Test Smartboard per question (the `FloatingTestBoardPage` flow, scoped by subsection id). A **View** action is added to the Exercise Card in the saved-course teacher UI.

**Student side.** `StudentExerciseQuestionsPage` gets a small "video" badge per question; the solving board is wrapped in `ThreeViewFrame` when a config exists for that `(blockId, questionId)`.

**Tests.** Unit tests for `sectionsFor` defaults/clamping/ordering, `sectionForLine` on a skip (Line 1 → Line 7), the completed-line no-replay rule, and that video Next/Previous produce no mathematical-state change (pure-function level).
