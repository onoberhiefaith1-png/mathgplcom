## Technical detail

All work is inside the marking engine; no client change is required.

- `supabase/functions/_shared/mathEquivalence.ts`
  - `deterministicVerdict`, equation-vs-equation branch: before accepting `direct`/`swapped`/`numeric` results, classify both lines.
    - `isVacuous(line)` — `lhs - rhs` simplifies (or samples) to 0.
    - If `isVacuous(student)` and not `isVacuous(teacher)` → `not_equal`.
    - If both vacuous (identity/simplification key line) → require `sidewiseEqual`: `teacher.lhs ≡ student.lhs && teacher.rhs ≡ student.rhs`, or the swapped pairing. Otherwise `not_equal`.
    - If neither vacuous → keep the existing leftover comparison (valid alternative solving steps stay correct).
  - `symbolsOf(line)` guard: any free symbol in the student's line that does not appear in the teacher's line → `not_equal` (reserved names `e`, `pi`, `i` excluded).
  - Expression-only teacher lines (no `=`): keep value comparison, but a student line that is itself an equation must have one side matching the teacher's value, not merely be internally consistent.
- `llmVerdict`: add explicit rejection rules ("a statement that is true but does not represent the teacher's line is NOT equivalent"), and after the AI answers `equal`, re-apply the vacuous and symbol guards before trusting it.
- `supabase/functions/_shared/lineDiagnosis.ts`: map the new rejection reasons to existing codes — vacuous student line → `not_equivalent` with a short label; unrelated symbols → `incorrect_expression`. No new label vocabulary.
- `supabase/functions/grade-line/index.ts`: unchanged apart from benefiting from the stricter verdict. `structurallyIdentical` short-circuit stays, so an exactly-written line is still always awarded.

### Verification

- Deploy the function and call it directly against the assignment currently being tested, with cases: `2 = 2`, `1 + 1 = 2`, `y = y`, a correct line from another question, the exact expected line, a valid alternative form of the expected line, and a genuine wrong answer. Expect marks only for the last two of those categories that should pass.
- Confirm on the student board that a real correct line still shows "Equivalent" and still awards its marks, and that the teacher Evaluation panel reports the same verdict.
