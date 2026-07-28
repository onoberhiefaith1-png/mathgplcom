## What I verified in the code

- **The Expected Line really does come from the floating set.** `src/lib/assessments/createAssessment.ts` builds the answer key as `tokens = cleanFillers(line.fillers)` — the floating chips — and only falls back to `tokensFromEquation(line.equation)` when there are no fillers. `grade-line` then joins those tokens with spaces and treats the result as `teacherAscii`. So the grader is comparing the student against the chip list, not the teacher's orange equation.
- **The teacher equation exists but is thrown away.** `FloatingLine` carries `equation`, but it never reaches the assessment payload; `assessmentBoardSource.ts` even hard-codes `equation: ""` when rebuilding board reservoirs.
- **Floating objects can silently disappear.** `cleanFillers` drops any filler that `isStillDirty()` rejects (anything still holding `\word`, `sqrt(`, `**`, leftover `^{}`/`_{}`). A filler such as a `\frac` template or `x =` written with raw syntax is removed with no warning, so the student's chip set is a strict subset of the teacher's.
- **"Symbol not supplied" comes from provenance checking.** `grade-line` computes `inFloatingSet` by requiring every student atom to be in `allowedFloatingTokens`; when it fails it short-circuits equivalence entirely and `lineDiagnosis.ts` returns `symbol_not_supplied` / `number_not_given`.
- **Check:** `checkActiveLine` freezes `resolveGradableLine(k).ascii`; when that resolves empty it only fires a "Nothing to check" toast and the result surface shows nothing — the student's written expression is never echoed back in the result view. (I have not yet reproduced the exact empty render in the browser; step 5 starts by reproducing it.)

## Plan

### 1. Expected Line = teacher's equation
- Add `equation` to the compiled question line payload and to `AnswerKeyLine` (`equationAscii`), sourced from `FloatingLine.equation`.
- In `compileSectionQuestions`, set answer-key tokens from the teacher equation first; fall back to fillers only when the equation is empty. Keep `chips` (student-facing) sourced from fillers as today — the two become genuinely separate objects.
- Preserve `equation` through `assessmentBoardSource.buildAssessmentBoardSource` instead of `equation: ""`.
- In `grade-line`, prefer `equationAscii` for `teacherAscii`, falling back to joined tokens for existing/legacy keys.
- Re-sync path: `pipeline.ts` and `LinkAdventureDialog.tsx` already rewrite answer keys on change, so edited equations propagate.

### 2. Lossless floating-number sync
- Stop silently dropping fillers: `cleanFillers` keeps every teacher filler, converting to Unicode where possible and passing the original through unchanged when conversion is incomplete, so nothing vanishes between teacher and student.
- Keep `containers` (fraction/radical/etc. templates) attached per line end-to-end so structure templates reach the student board.
- Add a compile-time integrity assertion: student chip count per line must equal the teacher filler count; log/flag a mismatch rather than shipping a lossy set.

### 3. Remove "symbol not supplied" / provenance rejection
- `grade-line`: delete the `inFloatingSet` gate; always run `equivalent(teacherAscii, studentAscii)`. Stop passing the verdict `not_in_floating_set`.
- `lineDiagnosis.ts`: remove the `not_in_floating_set` branch and the `symbol_not_supplied` / `number_not_given` codes from the union; keep `cannot_evaluate_yet` and the mathematical categories (incomplete line, missing bracket, sign error, not equivalent, equivalent, correct).
- `PresentationView.tsx`: keep sending `allowedFloatingTokens` only as informational context for the Reasoning panel, not as a validation input.
- Reasoning panel keeps showing "student-introduced terms" as *information*, never as an error.
- Update `src/test/lineDiagnosis.test.ts` accordingly.

### 4. Reasoning panel data sources
- Expected line: teacher equation (from the answer-key broadcast path already used).
- Available symbols: the line's floating set, displayed as a separate section.
- Student line: the live/frozen active-line ascii.
- Verdict: whatever the engine last broadcast — unchanged.

### 5. Check must show the student's work
- Reproduce the empty Check result in a headless browser first to confirm the render path.
- Make Check an evaluation *view*: on Check, render the frozen student expression, the verdict/diagnosis, and the marks awarded, with a "Back to board" action that leaves the board content untouched.
- When the resolved line is empty, still show the view with an explicit "nothing written on this line yet" state instead of a blank surface.

### 6. End-to-end verification
- Add a pipeline test walking teacher equation + fillers → compiled question → answer key → board source → grading, asserting: expected line equals the teacher equation, chip count is preserved, and a student expression containing manually typed symbols but mathematically equivalent grades as correct.
- Run the existing suites (`reasoningEngine`, `lineDiagnosis`, `boardScope`, `activeLineSession`, floating tests) plus a typecheck.

## Technical notes
Files touched: `src/lib/assessments/createAssessment.ts`, `src/lib/assessments/assessmentBoardSource.ts`, `src/lib/lessonnotes/floatingCompile.ts`, `src/lib/notebook/unicodeMath.ts` (filler retention only), `supabase/functions/grade-line/index.ts`, `supabase/functions/_shared/lineDiagnosis.ts`, `src/components/smartboard/PresentationView.tsx`, `src/components/smartboard/TeacherReasoningPanel.tsx`, plus tests. No database schema change is required — `assessment_answer_keys.lines` is JSON, so the added `equationAscii` field is additive and legacy rows keep working through the fallback.
