## What changes

1. One shared place to keep frozen questions, created the moment a question is handed out. The student-safe part (question, floating chips, containers, marks, notes, table workspaces) is kept separately from the hidden answer key, so students can never read marking data.
2. Adding a question to an Exercise Card writes the frozen copy immediately. Removing the link, or deleting the card or course, removes its copy — nothing else does.
3. Opening an Exercise Card (teacher view, student view, shared guest link) reads the frozen copy. The Lesson Note is no longer consulted.
4. Older Exercise Card questions created before this change are filled in once, quietly, the first time they are opened successfully; after that they too are independent.
5. The other four routes keep their existing behaviour and gain a guard: when a frozen copy already exists it is reused, never rebuilt from the note. Teachers who deliberately re-assign or re-publish still get a fresh copy, exactly as now.
6. No change to any screen, button, wording or workflow.

## Technical notes

- Staged additive migration: `assigned_questions` (id, owner_id, source ids for reference only, `question` jsonb, `total_marks`, created_at) and `assigned_question_keys` (assigned_question_id PK, `lines` jsonb). GRANTs: `authenticated` select/insert/update/delete on `assigned_questions`; `service_role` all on both; **no** anon or authenticated select on `assigned_question_keys` (owner/grader reads go through a security-definer function or an authenticated server function). RLS: read on `assigned_questions` allowed to the owner and to members of a class that references it, mirroring how assessment questions are already reached.
- `course_exercise_questions` gains `assigned_question_id uuid references public.assigned_questions(id) on delete set null` plus a snapshot marks column, all additive.
- New `src/lib/assessments/snapshot.ts`: `freezeQuestion(payload, answerKeyLines, source)` and `readFrozenQuestion(id)`. Everything reuses the existing `QuestionPayload` / `AnswerKeyLine` shapes, so the compiler, the board source builder and the grader stay untouched.
- `src/lib/courses/api.ts` (both insert sites) call `freezeQuestion` after `compileSectionQuestions`; `src/lib/courses/exerciseBoard.ts` `resolveLinks` reads `assigned_question_id` first and only compiles when it is null (then backfills). The per-class assessment created for solving keeps working unchanged — it is filled from the frozen copy.
- `src/routes/api/public/guest/$slug.ts` reads the frozen copy through the admin client for guest exercise links.
- `src/lib/assignments/pipeline.ts`, `src/lib/smartcards/smartCards.ts`, `src/lib/games/gameQuestions.ts`: no behavioural change; they already persist `assessments.questions` + `assessment_answer_keys`. Add the reuse guard and freeze the same payload into the shared table so lifetime and cleanup rules are uniform.
- Because this draft shares the live database, the new storage applies when the draft is accepted; the reading code is written now and exercised by unit tests against the frozen payload shape.
- Tests: freeze/read round-trip preserving every floating chip, container kind, marks, note, note-only line and table reference; exercise-card load with a deleted source note still returning the full question; guard test proving an edited note does not alter an existing copy. Plus `bunx tsgo --noEmit`.

## Out of scope

Diagrams and 3D scenes attached to a question are not part of the assigned-question payload today; this change freezes exactly what is handed out now and does not add them. No change to marking rules, grading, timers, UI or the Lesson Note editor.
