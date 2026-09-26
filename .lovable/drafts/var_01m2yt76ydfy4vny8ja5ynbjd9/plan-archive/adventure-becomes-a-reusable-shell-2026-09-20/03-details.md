## Technical detail

**Data (staged as an additive migration; applied when this draft is accepted)**

- `class_adventures` — `class_id`, `game_id`, `linked_by`, `created_at`, unique `(class_id, game_id)`. The class↔adventure link, independent of `class_games` (Game destination) so the two ownership models never mix. RLS + GRANTs scoped to class owner/teacher for write and class members for read.
- `adventure_bar_questions` — `class_id`, `game_id`, `progress_element_id`, `notebook_id`, `section_id`, `question_key`, `assignment_id`, `created_at`, `unassigned_at`. One row per question placed on one bar of one class adventure; repeats across bars allowed (unique on `(class_id, game_id, progress_element_id, question_key)`).
- `class_game_boards` gains `pass_pct` (int, nullable) for the per-bar pass percentage. Its `notebook_id`/`section_id` stay nullable and are no longer the grouping key — the board is now keyed only by `(class_id, game_id, progress_element_id)`.
- Start-fresh cleanup on accept: delete adventure-kind `assessments` + their `class_game_boards` and `class_adventure_notes` rows for adventures. Student `assessment_progress` rows are retained as history.

**Code**

- `src/lib/adventures/classAdventures.ts` — replace the note-centric API with `linkAdventure`, `unlinkAdventure`, `listClassAdventures` (reads `class_adventures`, no `ensureAssignment` per note).
- New `src/lib/adventures/barQuestions.ts` — `assignQuestionToBar`, `removeQuestionFromBar`, `listBarQuestions(classId, gameId)`, and `syncBarBoard(classId, gameId, barId)` which compiles the bar's active question sections via `compileQuestionSections`, upserts the single `assessments` row for that bar in place (`notebook_id: null`, title `"<Adventure> — <Bar>"`), rewrites `assessment_answer_keys`, and stores `required_marks` + `pass_pct` on the board. Replaces `syncAdventureBoards` in `pipeline.ts`.
- `src/lib/assignments/instances.ts` usage — the learning-assignment instance is keyed on `(class, game, bar)` instead of `(class, notebook, game)` so each bar owns its own card lifecycle.
- `src/components/lessonnotes/AssignDialog.tsx` (adventure target) — after class selection, show that class's linked adventures; then its bars with current question counts; empty state "No Adventure linked to this class yet." + Link Adventure. No auto-creation, no lesson-note fallback.
- `src/components/adventures/LinkAdventureDialog.tsx` — repurposed into the class-level adventure picker (list adventures of the active workspace, link/unlink). The bar occupancy block and `BAR_OCCUPIED_MESSAGE` are removed; bars accept many questions.
- `src/pages/class/ClassAdventuresPage.tsx` — rebuilt: `+ Link Adventure`, one section per linked adventure, inside it one row per progress bar with its questions, total marks, pass % input, and Unassign per question; group setup panel keeps using the primary bar.
- `src/lib/adventures/barLinks.ts` — `loadBarAssignments` returns a question list per bar instead of a single notebook; `unassignBar` becomes "clear this bar's questions" and no longer deletes the adventure link.
- Reads that assumed note grouping: `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/student/StudentAdventuresPage.tsx`, `src/pages/student/StudentClassPage.tsx`, `src/lib/reports/progressChart.ts`, `src/lib/assessments/lessonProgress.ts` callers — switch to per-bar boards, each bar reporting questions / total / achieved / percentage / pass state.
- Student side reads only `(their class, adventure, bar)` rows, so questions and progress cannot cross classes.

**Tests**

- Two lesson notes feeding three bars of one adventure; per-bar question sets and totals.
- Same question on two bars scored independently.
- Same adventure in two classes: each class's bar returns only its own questions.
- Unlinking from one class leaves the adventure and the other class intact.
- Per-bar pass percentage drives Pass / Not Passed independently.

**Note on the draft:** the new tables and the `pass_pct` column are staged here and only created when you accept this draft, so the new Adventures screens can be built now but can't be exercised end to end until then.
