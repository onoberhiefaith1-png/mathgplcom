# Restore student-owned real-time marking

## Goal
Restore one authoritative pipeline:

```text
Student edits active question line
  → student Smartboard evaluates after a short debounce
  → correct result is persisted to that student's assessment progress
  → the same result and updated marks are broadcast
  → teacher observes the student's board, verdict, and total live
```

The teacher view will remain read-only with respect to marking and will not run a second evaluator.

## Confirmed current state
- `PresentationView` currently starts two evaluations for the same active student line: a 500 ms non-persisting “live” check and a separate 900 ms persisting auto-check.
- The persisting path suppresses retries by recording its deduplication key before the request succeeds, so one failed or interrupted request can leave unchanged correct work unmarked.
- The backend already stores per-line marks under `questionId:lineId`; existing multi-question rows confirm marks from separate questions coexist and aggregate into one assessment score.
- `TeacherEvaluationPanel` already consumes student board/check broadcasts and reads `assessment_progress`; it does not need its own marking engine.

## Implementation
1. **Unify student evaluation**
   - Replace the competing 500 ms observation-only call and 900 ms persisting call with one debounced student-owned evaluation path.
   - Use the existing `grade-line` engine for manual Check, line exit, table completion, and idle completion.
   - Persist normal student evaluations; preserve non-persisting behavior only for explicit tester/test mode.

2. **Make evaluation reliable**
   - Deduplicate only successful evaluations, not requests that merely started.
   - Allow the same unchanged expression to retry after network/function failure.
   - Correct the grading callback dependencies so persistence mode and participant identity cannot be captured from a stale render.
   - Guard async responses with assessment, question, line, and expression identity so a late result cannot mark or display under another question.
   - Keep already-awarded `questionId:lineId` slots permanent and prevent double scoring.

3. **Stream the authoritative result**
   - Broadcast the result returned by the persisting student call, including question ID, line ID, verdict, marks, and updated aggregate progress.
   - Update the student's local progress from that same response.
   - Have the teacher panel refresh from the student result/realtime progress event while rejecting out-of-scope question payloads.
   - Publish the student's active-question presence for every assessment-board entry path, not only links carrying assignment/adventure query parameters.

4. **Preserve multi-question isolation**
   - Keep independent board state per assessment + student + question.
   - Keep line progress keyed by `questionId:lineId` and derive the overall assignment score from all solved slots.
   - Reset transient evaluation state when the student changes question without clearing persisted marks from other questions.

5. **Regression coverage and verification**
   - Add tests for automatic persistence, retry after a failed request, no duplicate award, stale-response rejection, and two questions contributing independently to one total.
   - Verify a student correct line updates stored progress and the teacher panel receives that exact evaluation without invoking grading itself.

## Scope
No redesign of assignments, Smartboard controls, grading rules, answer keys, expiry, or teacher workflows.
