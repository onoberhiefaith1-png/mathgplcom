## What changes

1. **Stamp the link at birth.** Every Solution area created — with a new Example / Classwork / Exercise / Homework / Assessment, with "Add Session (with solution)", or created on the fly during generation — is stamped with the owning question's durable id. No solution is ever created without an owner.

2. **A solution cannot outlive its question.** A structural pass runs when the note loads and after edits: a Solution whose owning question no longer exists is removed together with its body; a Solution that drifted away from its question is pulled back under it; a legacy Solution with no owner is adopted by the question heading directly above it.

3. **Numbering follows ownership.** "Solution 3" is derived from its owner question's number, not from whichever heading came last in the document. A question renumbered by reordering carries its solution's number with it.

4. **Editing never eats the solution.** Regenerating or AI-editing a question already stops at the Solution heading; the pass above makes that guarantee hold even when the block was moved or the note was saved from an older version.

5. **Generation always produces the pair.** Copilot already writes question → figure → solution per item; the plan tightens it so that a section holding several questions produces "Question 1 → Solution 1, Question 2 → Solution 2 …" with each solution numbered to its question, never a block of questions followed by a block of solutions.

6. **Reporting stays honest.** If a solution cannot be produced, the item is flagged as needing its solution rebuilt (existing behaviour) — it is never left as a lone question that claims to be complete, and never as a lone solution.
