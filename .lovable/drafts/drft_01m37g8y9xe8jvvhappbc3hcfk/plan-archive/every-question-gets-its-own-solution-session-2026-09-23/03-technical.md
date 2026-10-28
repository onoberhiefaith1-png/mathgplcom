## Technical detail

**Current state:** in the editor, a Solution is already its own heading (`sectionKind: "solution"`), tied to its question through `ownerQuestionId` (`questionPairs.ts`, `solutionPairing.ts`) and numbered from its owner (`autoNumber.ts`). `buildLessonOutline` treats it as its own segment (`isSolution`). But `syncDocumentToNotebook` puts it into the question's subsection as a `solution` block, and `buildQueue` makes the solution a sub-step of the question item. Step 0 checks exactly how the Smartboard shows that block today (as a separate step or on the same screen) before the step-4 change goes in.

**1. Structural standard.** Add `sessionPairingStandard.ts` in `supabase/functions/notebook-ai/` with the rules above (a Solution is a session, paired, numbered to match, one pair at a time). Add it to `sharedKnowledge.ts` so generation, edit and restructure all use the same rules.

**2. Validator.** Add `validateSessionPairs(outline)` to `structureValidator.ts`, based on `buildLessonOutline`. It reports: question with no owned Solution segment, Solution not directly after its question, grouped questions followed by grouped solutions, Solution under a non-question kind, and ordinal mismatch. It is used by generation (the build is rejected and repaired) and by Restructure.

**3. Generation.** `conversation.ts` `runBuild` keeps one item per question but always writes a stamped Solution heading straight after it (`solutionPlaceholderNodes` with owner id), even when solution generation fails. That heading is flagged "needs solution" rather than left out. The validator runs at the end.

**4. Smartboard.** In `syncDocumentToNotebook`, each question subsection is given an explicit two-state presentation (question state, then solution state), so navigation goes Question → Solution. The existing `problem`/`solution` block rows and `doc_key` identity stay the same, so Floating Numbers highlights are kept.

**5. Restructure lesson.**
- A new `notebook-ai` mode `restructure`. Input: the note as numbered top-level blocks (text + math). Output: a segment plan of `{kind, ordinal, blockRange, role: question|solution|content, pairsWith, tidiedText?, needsGeneratedSolution}`. It only classifies and tidies. It never invents mathematics, and a runtime QUESTION_LOCK check compares each question with its source.
- Client applier `src/lib/lessonnotes/restructure.ts`: a pure function that turns (doc, plan) into a new doc. It inserts stamped headings, moves existing solution blocks under their owner, and adds owned Solution headings. Then `enforceQuestionSolutionPairs` and `applyAutoNumbering` run, followed by `validateSessionPairs`.
- Missing solutions go through the existing verified solution path (`generateSolution` + completeness verifier). If that fails, the item is marked "needs solution".
- Before any change, a restore point is taken with the existing `snapshot_lesson_note`. The user sees a summary (moved / tidied / newly written / flagged) and chooses Accept or Undo.
- Entry point: a "Restructure lesson" button in the note's toolbar, next to the existing AI tools.

**6. Tests.** Pure tests for the validator and the applier: headings deleted, all-questions-then-all-solutions, question and solution in one block, unlabelled solution, question with no solution, explanation-only content (no Solution created). Also a sync test for the two-state Smartboard output, and an authenticated browser run on the open note.

**Not touched:** the pedagogy reference, QUESTION_LOCK, Floating Numbers extraction, Game, Aura (still archived), styling.
