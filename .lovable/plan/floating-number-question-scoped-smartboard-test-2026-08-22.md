# Floating Number → Question-Scoped Smartboard Test

## Goal
Add a "Test on Smartboard" path from the Floating Number page that opens the **existing** student Smartboard, scoped to exactly the question/solution being edited, with a throwaway test state. Plus a Floating Number Archive, and a real fix for the freeze/unresponsive problem.

Nothing about the Smartboard, marking, floating-number checking, teacher hint or the reasoning/evaluation engine is rebuilt. Only launch, scope, reset and stability change.

## 1. Test on Smartboard (question-scoped)

- Add a **Test on Smartboard** button to the Floating Number page top bar. It first flushes pending edits (existing save path), then routes to a new test route.
- New route `/lesson-notes/:notebookId/floating/:subsectionId/test` renders the existing `PresentationView` in student assessment mode — the same component the student assignment board uses.
- The board content comes from the existing compiler for this question only (`compileSectionQuestions` → one question + its floating lines + marks), so no other example and no other part of the lesson note is loaded.
- The board is keyed by the existing board-scope identity (student × class × workspace × question) with a dedicated `floating_test` workspace, so switching questions forces a clean remount and no carry-over of work, score, floating state or evaluation state.

## 2. Reusing the real marking engine

- Grading keeps using the existing `grade-line` engine and the teacher's stored answer key — no second scoring system.
- Because grading needs a real question record, the teacher gets one hidden, private **Floating Test** container (created once per teacher, reused forever) that holds the test question record for the section being tested. It is not visible in Teaching Hub, never assigned, and never appears to students.
- Scores accumulate live during the test (0/400 → 400/400 style) using the same per-line marks the question defines. A zero-mark question still works fully — writing, floating numbers, consistency checking, hint and evaluation all run; only the score stays 0/0.

## 3. Test state is temporary

- Test grading runs in the engine's existing **dry-run** mode: verdicts, diagnosis and marks come back, but nothing is written to student progress, assignment completion, class progress or assessment records.
- Score and solved lines for the test live in memory only, seeded empty on open.
- Board caches for the test workspace are cleared on entry and on exit, so leaving and returning always starts blank with score 0.
- Exiting returns to the Floating Number page; lesson note, question, solution and generated floating numbers are untouched.

## 4. Evaluation (renaming, not rebuilding)

- The teacher Reasoning panel keeps all of its current analysis functionality; its visible label, button, tooltips and headings become **Evaluation**.
- Teacher Hint stays exactly as it is and is available in the test board.

## 5. Floating Number Archive

- Add an **Archive** tab/section beside Generate on the Floating Number page.
- It lists previously generated floating-number configurations for the lesson, each showing its lesson → session → question → solution relationship, with actions to open the configuration or launch its test board.
- Archive stores references to the existing subsection/floating records — no duplication of lesson content, and no change to the existing Generate → Test workflow.

## 6. Freezing / unresponsiveness — root cause work

Confirmed signals so far: a failed dynamic module load (`DocumentEditor` chunk) after a new build leaves the editor route stuck until a hard refresh, and there is a DOM-nesting warning (nested buttons in the Asset Library) indicating remount churn.

Fixes:
- Recover from stale chunk loads: catch dynamic-import failures at the route boundary and show a "Reload this page" recovery card instead of a dead screen.
- Fix the nested-button structure in the Asset Library tiles (favourite heart inside the tile button).
- Generate guard: a single in-flight guard so rapid clicks cannot start parallel generations; `loading` is always released in `finally`, on error and on timeout, with a visible retry.
- Every long async action on this page (Generate, Save, board open, question/solution load, evaluation load, marking, archive) goes through the existing timeout + friendly-error + single-flight helpers so no loading state can stay stuck.
- Release UI locks on failure: panels/overlays close, controls re-enable, error is recoverable. Recovery only resets temporary request/UI state — never lesson content, floating numbers, solutions, diagrams or tables.
- Add dev-only diagnostic logging (operation, question/solution/floating id, start, end, outcome, error) around those operations. Not shown to teachers.
- Audit the Floating Number page and test board for repeated effects, duplicate subscriptions/listeners and stale async writes after unmount, and cancel late responses.

## Technical notes

- Reuses: `PresentationView` (student/assessment mode), `grade-line` (dry-run), `compileSectionQuestions`, `buildAssessmentBoardSource`, `buildBoardScope`, `TeacherReasoningPanel`, `resilient`/`withTimeout`/`singleFlight`.
- New: one test route + a thin test-board page, a `floating_test` board workspace value, an archive list view, and a hidden per-teacher test container row.
- Additive migration only if the archive needs a reference table; no changes to existing lesson/floating data shapes.

## Verification
Walk the 15 listed success tests: question isolation both directions, live score updates, blank board on re-entry, floating checking, marking, hint, Evaluation label, archive contents, double-click Generate, hung-operation recovery, Back button, panel reopen, and refresh integrity.
