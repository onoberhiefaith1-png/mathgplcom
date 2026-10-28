# Test Smartboard: always a clean, disposable sitting

The duplicate-key screen must never appear, and re-entering the test board must always start blank. Nothing about normal lesson boards or real student boards changes.

## What is actually going wrong

Opening the test board runs one sequence: find/create the hidden test question record, then **delete the stored answer key and insert it again**. Because the open routine has no single-flight guard, it can run twice for the same entry (route mount, a second effect pass, or a fast re-entry). Two interleaved runs both delete, then both insert the same primary key (`assessment_id`), and the second insert fails with:

```text
duplicate key value violates unique constraint "assessment_answer_keys_pkey"
```

So the error is a session-creation lifecycle problem, not a display problem. It gets fixed at the source: the answer key is written as a single conflict-safe write, and only one open can be in flight at a time.

## Corrections

1. **One write, no delete-then-insert.** The answer key for the test question is written in one atomic conflict-safe operation keyed on the assessment id. A duplicate primary key is then structurally impossible, so no error can surface.

2. **One open at a time.** Entering the test board reuses the in-flight open if one is already running, instead of starting a parallel one. No double record creation, no race.

3. **Every entry is a new test sitting.** On entry the board mints a fresh sitting identifier and clears everything from any earlier sitting before rendering:
   - board caches for this test scope
   - any leftover progress/score rows for the test record
   - evaluation feed state, current line, marks

   Result: writing blank, marks 0, evaluation reset — while the question and its expected solution load normally.

4. **Stale sittings are disposable, never restored.** If a previous sitting exists (browser closed, refresh, crash, navigation away), it is discarded rather than resumed. No restore attempt, therefore no collision to recover from.

5. **No "Try again" for this condition.** The recovery card stays only for genuine failures (e.g. the solution has no floating numbers yet). Session-collision conditions are resolved automatically before the board renders, so the teacher simply sees a fresh board.

6. **Other boards untouched.** The reset-on-entry behaviour stays confined to the Floating Number test environment. Lesson boards and real student boards keep continuing where they stopped, and their persistence rules are not modified.

7. **Test data stays isolated.** The test still writes nothing to student answers, assignments, assessment records, progress, marks or submissions; the reset only touches the hidden test record's temporary state.

## Technical notes

- `src/lib/floating/testBoard.ts`
  - replace the `delete` + `insert` on `assessment_answer_keys` with a single `upsert` on `assessment_id` (conflict target = primary key), so repeated opens are idempotent.
  - wrap `ensureFloatingTestBoard` in a per-subsection single-flight promise cache so concurrent calls share one result.
  - keep the existing duplicate-assessment cleanup, and keep clearing `assessment_progress` for the test record; return a freshly generated `sittingId` alongside the existing ids.
  - treat a `23505` from any write as "already correct" → re-read/update rather than fail.
- `src/pages/floating/FloatingTestBoardPage.tsx`
  - include the returned `sittingId` in the `PresentationView` key and in the board-scope clear on entry and unmount, so each entry mounts a genuinely empty board.
  - no change to `testMode`, `persist: false`, the Evaluation panel wiring, or the note pipeline.
- No migration. No change to marking, grading, scoring or persistence rules for any other board.

## Verification

Open Test on Smartboard, write a few lines and let them mark; go Back to floating numbers, then re-enter: board blank, marks 0, evaluation empty, question and expected solution present, no error card. Repeat several times quickly. Then confirm a real student assignment board still resumes previous work after leaving and returning.
