## Goal

Check Line stops saying "not equivalent" and instead names the *type* of mistake in 1–3 words. Marking/scoring behaviour is unchanged: only a line that is truly equivalent earns marks.

## Current state (verified)

- The Check Line button calls `gradeLineThroughEngine` in `src/components/smartboard/PresentationView.tsx`, which invokes the `grade-line` edge function.
- `grade-line` compares the student's ASCII line against the teacher's stored answer-key line using `supabase/functions/_shared/mathEquivalence.ts`, which returns only `equal` / `not_equal` / `unknown` (plus the `not_in_floating_set` and `parse_error` special cases).
- The toast currently shows one long sentence ("That line isn't mathematically equivalent to the expected step."). `TeacherReasoningPanel.tsx` maps the same verdict to a longer explanation sentence.

So there is exactly one grading pipeline to extend — no duplicate logic to reconcile.

## What gets built

### 1. New diagnosis engine (server, shared)

New file `supabase/functions/_shared/lineDiagnosis.ts` that takes `(teacherAscii, studentAscii, equivalenceVerdict)` and returns:

```
{ code: "incorrect_sign", label: "Incorrect sign", detail: "…one sentence for the Reasoning panel…" }
```

Detection order (first match wins — this encodes the Priority Rules):

1. **Invalid expression** — fails to parse, or malformed patterns (`==`, `++x`, trailing/leading operator pileups).
2. **Incomplete line / equation / simplification** — student has no `=` while the expected line has one and the student text is a strict prefix-shaped fragment of it → "Incomplete line"; student ends with `=` and nothing after → "Incomplete equation"; expected line is a simplification (`x + x = 2x`) and the student wrote only the un-simplified LHS → "Incomplete simplification".
3. **Missing equals sign** — expected has `=`, student has none, and the student's characters otherwise account for both sides.
4. **Missing bracket** — unbalanced parentheses, or bracket count lower than expected with the same atoms.
5. **Equivalent** — equivalence engine says `equal` → "Equivalent" (green, awards marks).
6. **Incorrect sign** — flipping the sign of one side/term (or of the differing numeric atom) makes the line equivalent.
7. **Incorrect calculation** — structure matches but a single numeric result differs (both sides are pure arithmetic, or the differing atom is a lone number in an otherwise identical skeleton).
8. **Incorrect expansion** — expected line contains a product of brackets / a squared bracket and the student wrote a partially-distributed form.
9. **Incorrect factorisation** — student wrote a bracket product whose expansion ≠ expected expression.
10. **Incorrect substitution** — same skeleton, a substituted numeral differs from the value supplied by the question/floating tokens.
11. **Incorrect rearrangement** — same multiset of terms as expected but a term moved across `=` without sign change.
12. **Missing term / Extra term** — term multiset differs by exactly one absent / one added term.
13. **Incorrect expression** — meaning-changing difference not covered above.
14. **Not equivalent** — final fallback.

Each rule is a small pure function over a normalised token/term model built on the existing `normalize()` + mathjs parse already in `mathEquivalence.ts`; sign/calculation/expansion checks re-use the existing `equivalent()` comparison on mutated candidates (e.g. sign-flipped student line).

### 2. `grade-line` returns the diagnosis

`supabase/functions/grade-line/index.ts` adds `diagnosis: { code, label, detail }` to every response (dry-run and persisted). Existing `correct` / `verdict` / `marks` fields are unchanged, so the teacher mirror and progress logic keep working. `not_in_floating_set` and parse failures map to their own labels ("Number not given", "Invalid expression").

### 3. Short popup feedback

`PresentationView.tsx`: the failure toast becomes title = the short label ("Incorrect sign"), with no long description. Success stays "✓ Line verified +N marks" and additionally shows "Equivalent" when the student's route differed from the expected line. The check-result broadcast carries `diagnosis` so the teacher sees the same label live.

### 4. Detailed explanation in the Reasoning panel

`TeacherReasoningPanel.tsx` shows the short label as a heading plus the longer `detail` sentence and the two compared lines — that's where the explanation lives, never in the popup.

### 5. Tests

New `src/test/lineDiagnosis.test.ts` (importing a mirrored client copy or the shared module via path alias, matching how existing shared-engine tests are wired) covering every example pair from the specification: 2x=8 vs x=4 → Equivalent; 2x+5 vs 2x+5=9 → Incomplete line; 6×4=26 → Incorrect calculation; 2x=-4 → Incorrect sign; 3(x+2) vs 3x+2 → Incorrect expansion; x+510 → Missing equals sign; 3x=10 → Missing term; 2x+5+1=9 → Extra term; 2x==6 → Invalid expression; 3x=15 → Not equivalent, and the rest.

## Technical notes

- No database or schema changes.
- No LLM call is added to the fast path: diagnosis is deterministic and runs after the existing equivalence verdict, so Check Line stays as fast as today. The existing LLM fallback inside `equivalent()` is untouched.
- Answer key still never leaves the server for students; only the short label and the category detail are returned.
