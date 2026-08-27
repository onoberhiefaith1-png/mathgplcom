# Fix instant student marking (assignments + adventure)

Your instinct was right: the hold-up is on the payment/credit side, not the maths engine. Marking also has no failure state, so one refused request leaves the panel spinning "Evaluating…" forever — which is what you watched for 20 minutes.

## What is actually happening (verified in code and data)

1. The line grader (`grade-line`) is wrapped by the credit meter, exactly like the AI generators. Before any grading happens it:
   - reads the caller's profile,
   - checks the AI entitlement of the caller,
   - checks whether the caller's plan allows AI,
   - reserves 0.5 credits, and refuses with `402` if the caller has no plan/credits.
   The caller here is **the student**, so a student with no plan or no credits is refused before a single line is compared. That is why the same board marks instantly when *you* test it (your account passes the gate) and never marks for the student.
2. Even when it is not a refusal, that gate adds several round trips per line, so marking is slow rather than instant.
3. In automatic mode the board treats every failure as "not finished": it returns silently, broadcasts nothing, and retries once. The teacher's Evaluation panel therefore never receives a verdict and keeps showing "Evaluating…" indefinitely, with no error and no timeout.
4. The answer keys for your recent assignments exist and are correct, so grading itself is not the defect.

## The fix

### 1. Marking is never a paid, gated action for the student
Automatic marking of a student's line is part of doing the assignment, not an AI purchase. `grade-line` stops being credit-gated and stops charging the student. Its AI usage is still metered, but recorded against the assignment **owner's** (teacher's) account, so cost reporting stays honest and no student is ever blocked or charged. Teacher pricing for *access* to assignments is unaffected: that decides whether a student can open the assignment at all, never whether their work gets marked once they are inside.

### 2. Grading is instant, symbolic-first
Removing the gate removes the pre-flight round trips, so the common case (student line matches the expected step) returns from the fast symbolic/structural comparison with no AI call at all — the same path your test board uses.

### 3. Start point / end point stays exactly as defined
No change to when marking fires: entering a line is the start point, leaving it (or Check, table completion, or the settle pause on the open line) is the end point. Marking still happens on the student's board, is persisted from there, and is only *visible* to the teacher. Nothing new appears on the student's screen.

### 4. A failed evaluation is reported, never left spinning
- Every automatic evaluation now finishes with an outcome broadcast, including failure, so the Evaluation panel can show "Could not evaluate — retrying" instead of an endless spinner.
- The panel gets a stall guard: if no verdict arrives within a few seconds it stops spinning and shows that state, then clears as soon as a real verdict lands.
- Retries continue in the background, so a transient network or function hiccup still ends with the line marked.

### 5. Adventure uses the same path
Adventure boards run the same student Smartboard and the same grader, so all of the above applies to them unchanged. Verification covers both an assignment board and an adventure board.

## Technical notes

- `supabase/functions/grade-line/index.ts`: drop `meterFunction("grade-line")`; keep usage accounting via `withUsageMeter` attributed to `assessment.owner_id` (resolved after the assessment row is read), so no credit reservation, entitlement check, or `402` can ever sit in front of student marking.
- `src/components/smartboard/PresentationView.tsx`: `gradeLineThroughEngine` in `auto` mode broadcasts a failure result (`verdict: "error"`) instead of returning silently; `silentAutoCheckLine` keeps its bounded retry and only commits its dedupe key on a real verdict.
- `src/components/smartboard/TeacherEvaluationPanel.tsx`: add a stall timeout for the "Evaluating…" state plus rendering of the error verdict; keep the existing question scoping so a verdict from another question is still ignored.
- Tests: automatic marking succeeds without any credit/plan state, a refused/failed request surfaces as an error verdict rather than a permanent spinner, and marks from two questions still aggregate into one total.

## Verification

Student writes line 1 on an assignment → the line is marked and stored within a second, with the teacher's panel not open; the teacher then joins live and sees the mark already awarded. Same run repeated on an adventure board. A deliberately failed grade request shows "could not evaluate" and then marks correctly on retry.
