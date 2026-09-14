# Problem Check → Mathematical Referee

Replace the old presence-based Problem Check with an intelligent validation layer. Question and solution generation stay exactly as they are.

## What changes for the teacher

- A question with no solution yet, no diagram, or no table is never flagged. Copilot just generates.
- Editing a question, table, diagram or solution by hand is never treated as an error.
- Mathematics stored in a Smart Table, diagram, graph or Floating Numbers counts as part of the question.
- A message only appears when there is a real mathematical problem, and it says what was found, why it matters, and gives choices that fit that problem.
- Choosing an option continues immediately with that decision — the teacher never has to re-explain.

## Detected problem types

Incomplete question (genuinely missing data), no valid solution, requested method unsuitable, contradictory information, table conflicts with question, diagram conflicts with question, graph conflicts with question, incorrect mathematical information, existing solution incorrect, solution answers a different question, incorrect calculation, unit inconsistency, insufficient constraints, ambiguous question, missing referenced content, unreadable mathematical object, invalid domain/conditions, multi-step inconsistency. The list is extensible.

Each type carries its own actions, e.g.
- Incomplete: Add missing information · Let Copilot complete it · Rewrite question · Cancel
- Wrong method: Use another method · Amend question · Continue with requested method · Cancel
- Wrong existing solution: Correct it · Regenerate · Keep it · Cancel
- Table/question conflict: Correct table · Correct question · Use table data · Cancel

## How it works

1. Gather the whole problem: heading, question text, instruction, equations, Smart Tables, matrices, diagram/geometry inventory, graphs, Floating Numbers, referenced earlier items, and any existing solution.
2. Send that package to the Math Engine for a single reasoning pass which attempts the mathematics.
3. If it reports no genuine issue (or is unavailable), generation proceeds silently.
4. If it reports an issue, show the review panel with the typed explanation and its own actions; the chosen action is fed back into the same generation call.

## Technical outline

- `src/lib/lessonnotes/problemDetect.ts`: delete `analyzeProblem`, `ProblemReport`, `ProblemStatus`, `statusTitle`, `isTruncatedMath`, `needsFigure`, `carriesOwnData`. Keep the structural-label helpers (`isStructuralLabelLine`, `stripLeadingStructuralLabel`, `stripDuplicateHeading`) — they are used for question scoping, not error detection.
- New `src/lib/lessonnotes/ai/problemReview.ts`: builds `ProblemContext` (text, instruction, tables serialised from Smart Table nodes, diagram summary via `diagramsOwnedByQuestion`, floating lines, existing solution, referenced items from the session package) and calls the new backend mode; returns `{ ok } | { issue: { type, title, detail, affected, recommendation, actions[] } }`. Any transport/model failure resolves as `ok` so the teacher is never blocked.
- New `supabase/functions/notebook-ai/reviewStandard.ts`: the referee prompt — reason over the complete problem first, enumerate the allowed issue types and their action sets, and the explicit non-errors (missing solution, missing diagram/table when not required, teacher edits, alternative valid methods, equivalent wording/layout). Add `mode: "review"` to `notebook-ai/index.ts` returning strict JSON, reusing existing pedagogy/integrity standards.
- `ProblemCheckDialog.tsx` → `ProblemReviewDialog.tsx`: renders the typed issue and its actions as buttons; resolves the chosen action id.
- `DocumentEditor.tsx`: replace `report.status !== "valid"` gating in `getSolutionSource`/generation with `reviewProblem(...)`. `problemText`/`hasInheritedQuestion` (QUESTION_LOCK inheritance) keep working from the scoped text and session owner, unchanged. The chosen action is appended to the generation prompt as a decision directive (e.g. "Use a valid method instead of substitution", "Complete the question first", "Keep the teacher's solution").
- Manual and AI Builder modes are untouched; review runs only on Copilot generation paths.
- Tests: new `src/lib/lessonnotes/__tests__/problemReview.test.ts` covering the non-error cases (plain question with no solution, table-only data, diagram-only data, teacher-edited question) and genuine cases (missing data, table total conflict, unsuitable method), plus removal of references in `figureWarningAndMacroResidue.test.ts` / `rowSeparators.test.ts`.
