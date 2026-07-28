## Goal

Every question opened by a student gets its own independent SmartBoard. Work is restored only when the student returns to the exact same student + class + question + workspace (Assignment or Adventure). Anything else starts blank.

## What I verified (current behaviour)

1. **Browser-cached board content is keyed only by notebook.** In `PresentationView.tsx`, the persisted ink/structure keys — `smartboard:smartlines:${notebookId}`, `smartboard:boxes:${notebookId}`, `smartboard:freewrite:${notebookId}`, plus sensor/zoom/offsets/float-line keys (lines ~487-492, 586, 638, 659, 2278) — contain no class, assessment, or question id. Two questions in the same lesson note share one cache, and the same lesson note assigned to Class A and Class B shares one cache. **This is the direct cause of both the question-to-question and Class A → Class B leaks the user saw.**
2. **Nothing clears the board when the question changes.** The effect that applies loaded state returns early when there is no saved row (`PresentationView.tsx:3219`), so leftover React state from the previous question stays on screen. A `resetBoard` helper exists (~3947) but is never called anywhere.
3. **The page does not remount between questions.** The route `/student/class/:classId/assessment/:assessmentId` (`App.tsx:139`) is unchanged when only `?q=` changes, and there is no `key` forcing a remount, so all in-memory board state survives the switch.
4. **Server-side board rows are already per-question and per-class**: `assessment_question_board_state` is unique on `(assessment_id, student_id, question_id)`, and each `assessments` row is fixed to one `class_id`. There is one narrow fallback: when an assessment has no questions, the session drops to the legacy `assessment_board_state` row keyed only by `(assessment_id, student_id)` (`useAssessmentBoardSession.ts:107-114, 229-242`).
5. **Re-assigning a question revives the old assessment row.** `src/lib/assignments/pipeline.ts:260-280` reuses the existing `assessments.id` and attaches it to a brand-new `learning_assignments` instance, while no board-state or progress rows are ever deleted. A reassigned question therefore reopens with the previous cycle's board and score, contradicting the "brand new instance starting from zero progress" contract documented in `src/lib/assignments/instances.ts:14-16`.

## The fix

### 1. One board scope key (frontend)

Add `src/lib/smartboard/boardScope.ts` exporting a single identity string:

```text
board:<studentId>:<classId>:<workspace>:<assessmentId>:<questionId>
```

`workspace` is `assignment` or `adventure` (Adventure already routes through the same page with `?source=adventure&game=...`; the game id joins the key so different adventures stay separate).

### 2. Namespace every cached key by that scope

In `PresentationView.tsx`, replace the `notebookId`-only suffix with the scope key for all board-content keys: smartlines, boxes, freewrite, offsets, sensor, float-line index, lesson cursor. Purely cosmetic preferences (surface, ink colour, profile, zoom, panel open/closed) stay global — they are teacher/student display settings, not work.

When not in assessment mode, the scope falls back to the current `notebook:<id>` suffix so the teacher SmartBoard behaves exactly as today.

### 3. Reset the board on scope change

Force a clean slate whenever the scope key changes:

- Give `PresentationView` (or the `AssessmentBoardPage` wrapper) `key={boardScopeKey}` so React fully remounts on question/class/workspace change — the cheapest and most reliable reset.
- As a belt-and-braces guard inside the board, an effect on `boardScopeKey` clears `smartLines`, `boxes`, `freeLines`, line offsets, active line index and beat cursor before the loader runs, and only paints content once the load for the *current* scope resolves. Stale in-flight loads from a previous question are discarded by comparing the scope captured at request time.

### 4. Close the server-side gaps

- **Legacy fallback**: when `questionId` is missing, do not read or write the shared `assessment_board_state` row — start empty instead. The per-question table becomes the only write path.
- **Teacher Reasoning panel** (`TeacherReasoningPanel.tsx:121-127`) currently reads the legacy row without a `question_id` filter; scope that read to the active question so teachers never see another question's work.
- **Assignment revival**: when `pipeline.ts` revives an existing `assessments` row for a new `learning_assignments` instance, delete that assessment's `assessment_question_board_state`, `assessment_board_state` and `assessment_progress` rows in the same operation, so a re-assigned question genuinely starts from zero.

### 5. Tests

Add `src/test/boardScopeIsolation.test.ts`:
- Scope key changes when any one of student / class / question / workspace / game changes, and is stable when none do.
- Storage keys built from the scope never collide across two questions of one notebook, or across two classes using the same notebook.
- The load path ignores a response whose scope no longer matches the active scope.

## Expected result

- Open Question 1 → blank board. Leave, reopen Question 1 → previous work restored.
- Open Question 2 → blank board, no trace of Question 1.
- Same question in another class → blank board.
- Same question via Adventure instead of Assignment → its own independent board.
- Teacher SmartBoard and presentation behaviour unchanged.

## Note on point 5

Deleting board/progress rows on re-assignment means a teacher who unassigns and re-assigns a question wipes students' earlier attempts for it. That matches the "every assignment session is independent" rule you stated, but tell me if you'd rather keep the old work archived instead of deleted.
