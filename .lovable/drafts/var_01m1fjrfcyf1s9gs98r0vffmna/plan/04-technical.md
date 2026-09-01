## Technical detail

- `src/components/lessonnotes/DocumentEditor.tsx`
  - `solutionPlaceholderNodes()` (line 696) takes an `ownerQuestionId` and sets it on the Solution heading attrs. All call sites (`insertSection` 2534, `insertCustomSession` 2559, generation trailing nodes ~1741, `copilotSolutionAi` 2938) pass `ensureOwnerQuestionId(editor, questionHeadingPos)`.
  - `findSolutionHeading` / `copilotSolutionHeading` prefer the owner-id match before the positional scan.

- New `src/lib/lessonnotes/questionPairs.ts` (pure, unit-tested):
  - `enforceQuestionSolutionPairs(doc)` → `{ doc, changed }`: drops orphaned Solution headings plus their body, re-homes drifted ones inside their owner's section, adopts unowned legacy Solutions from the preceding question heading.
  - `solutionOrdinalFor(questionId)` helper used by numbering.
  - Wired next to `reconcileSolutionOwnership` in the `normalizedDoc` memo (~1934) so every load heals, and run after structural edits.

- `src/lib/lessonnotes/autoNumber.ts`: `applyAutoNumbering` resolves a Solution heading's ordinal from its `ownerQuestionId` question, falling back to the current positional ordinal only for unowned legacy headings.

- `src/lib/lessonnotes/copilot/conversation.ts`: the solution instruction already restates the question verbatim; for multi-question items it additionally requires each solution to be labelled with its question number so the pairing survives into the written text.

- Tests: new `questionPairs.test.ts` (orphan removal, drift re-homing, legacy adoption, delete-question-removes-solution) plus an `autoNumber` case for ownership-driven numbering. Typecheck and the existing lesson-note suites must stay green.

Not touched: pedagogy rules, QUESTION_LOCK, blueprint/validation stages, geometry, styling, notebook-ai prompts other than the pairing sentence above.
