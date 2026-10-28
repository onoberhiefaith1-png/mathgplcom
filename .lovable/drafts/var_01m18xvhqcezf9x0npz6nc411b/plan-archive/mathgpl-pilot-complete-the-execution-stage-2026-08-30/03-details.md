## Technical detail

### Draft stage (`notebook-ai`, stage `blueprint`)
- Response shape per item gains `id` (`example_001` form) and `question` (the actual question, math markup, empty for non-question kinds). `plan`, `needsDiagram`, `asset3d`, `note` stay as they are.
- Questions are produced through the existing math-engine path with the existing standards (pedagogy reference, question-task standard, validator), so the draft question is already a verified, valid question rather than throwaway prose.
- Large drafts are generated in kind-sized batches server-side so a big structure (10 examples + 20 classwork) never truncates.

### Build queue (`src/lib/lessonnotes/copilot/procedure.ts`)
- `BuildItem` gains `id` (stable, `${kind}_${nnn}`) and `question` (approved text) alongside the existing `key`. `buildQueue` assigns ids from a per-kind counter that continues past the highest existing id, so added items never reuse one.
- `itemInstruction` gains a question-lock branch: when `item.question` is set, the instruction is "use this exact question verbatim" rather than "write a question", matching the existing QUESTION_LOCK rule.

### Blueprint card (`BlueprintCard.tsx`)
- Renders the question for question-bearing items, with per-item edit / replace / delete, an "add another" control per kind, and the existing revise-by-instruction control. Editing the question sets `edited` and clears any previously generated solution state for that id.

### Build run (`conversation.ts` → `runBuild`)
- Unchanged order and cancel/pause behaviour. Per item: insert section → commit approved question (verbatim) → generate solution when `withSolution` → mark done. The item id is written onto the note section so the note itself carries the identity.
- `DocumentEditor` bridge gains `commitQuestion(ref, questionText)` and an `itemId` attribute on the section, so the pair is addressable after the build. Existing `generateQuestion` / `generateSolution` remain for every current caller.

### Post-build item edits
- Supervision-stage instructions naming an item ("change Example 2", "make Classwork 3 harder", "change the solution to Example 1", "add two more exercises") resolve to a single item id and run only that item's regeneration.
- A question-text change (teacher typing in the note, or AI revision) marks that id's solution stale; the stale solution is regenerated, verified and replaced. Detection uses a stored hash of the committed question text.

### Verification
- The existing `validator.ts` / `completenessVerifier.ts` gates are applied to every generated solution before it is committed; a solution that fails is regenerated once and, if it still fails, the item is reported to the teacher rather than silently accepted.

### Explicitly untouched
Smartboard architecture and floating-number extraction, section kinds and labels, structure card and number selectors, additional-information intake, persistence tables, and student-facing presentation rules.

### Verification before finishing
Typecheck, the existing lesson-note/copilot tests, and an authenticated browser run through a small lesson (2 examples + 2 classwork): draft shows real questions with ids, edit one question, second Proceed writes both questions with full linked solutions, then "change Example 2" alters only that item.
