## Technical detail

Label integrity
- Add a `structuralLabelLine()` guard used by `aiTextToNodes` / `aiTextToSolutionRows`
  (`src/lib/lessonnotes/aiToNodes.ts`): a line matching a section label from
  `sectionKinds.ts` (with optional number/colon) becomes a heading node and is excluded
  from math conversion and from `solutionRow` packing.
- Reproduce first with a unit test that feeds generator-shaped complex-number text and
  asserts headings come out as exactly `Solution 1`, `Solution 2`, `Example 2` — this test
  pins the real split point before any fix lands.
- Keep `applyAutoNumbering`'s single-text-node precondition; add a test that a heading with
  marks/inline math is left untouched.

One question = one section = one solution
- `problemDetect.ts`: split enumerated and lettered sub-parts into separate solvable units,
  each carrying its own verbatim question text (QUESTION_LOCK preserved per unit).
- `lessonOutline.ts`: emit one numbered section per unit for every solution-bearing kind;
  add `assessment` to `SOLUTION_SECTION_KINDS` so it matches `blockKindFor()`.
- `solutionPairing.ts`: keep the existing owner-id reconciliation; add a helper asserting
  every question id has exactly one solution frame.
- `structureValidator.ts`: fail on grouped questions, duplicate ordinals, missing or empty
  solutions; generation reports incomplete instead of shipping unsolved questions.
- Server side (`supabase/functions/notebook-ai/*`): prompt/contract states one unit per
  section with a complete solution, and the existing integrity guard rejects a response
  whose unit count does not match the detected questions.

Math rendering
- `src/lib/notebook/mathDisplayGate.ts`: `repairTemplates()` reads a single-token argument
  when no brace follows (`\frac12`, `\frac ab`, `\sqrt2`) and, when repair is unavoidable,
  advances past the consumed operands so digits cannot leak into prose.
- Extend `rewriteSlashFractions` coverage for parenthesised and mixed expressions already
  handled by `mathTokens.readStructureAt`, so exponents, radicals, subscripts, sums,
  products, integrals, limits and matrices arrive as whole structures.
- Tests in `src/lib/notebook/__tests__/` for each notation family, asserting rendered
  structure (fraction with numerator and denominator present) and no residual text.

Contrast
- Solution/feedback and problem-check text switch from muted/low-opacity classes to
  `text-foreground` (and `text-destructive` / `text-primary` for status) at a readable size,
  in the lesson-note editor and the Problem Check dialog only.

Verification
- `bunx tsgo --noEmit`, the new and existing lesson-note/math Vitest suites, and an
  authenticated browser pass generating a complex-number lesson with several questions:
  every question has its own numbered section with a complete solution, every `Solution N`
  label is intact, fractions render stacked, and check text is legible.
