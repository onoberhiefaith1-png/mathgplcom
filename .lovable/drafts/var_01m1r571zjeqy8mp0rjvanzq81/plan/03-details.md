## The note itself

Topic: circle geometry — cyclic quadrilaterals (opposite angles supplementary, exterior angle equals interior opposite angle, angles in the same segment, tangent-chord where it applies).

- 3 worked examples, each with its own figure and a full solution ending on a stated answer.
- 4 classwork questions in increasing difficulty, each with a complete solution.
- Question and its solution stay linked as one item; a figure belongs to exactly one question and is never redrawn above the Solution.

## Technical detail

- Investigation first: an authenticated browser run of the Co-Pilot build for this exact structure, watching the build loop in `src/lib/lessonnotes/copilot/conversation.ts` (`runBuild`) and the edge function response for the item where it stops. Whatever the reads show — a thrown bridge error, a self-pause, a rejected completeness gate, an abort — is the thing fixed; the plan does not assume which.
- Resilience in `runBuild`: an item whose question, figure or solution fails is retried once, then marked failed with the reason on that item's step, and the loop continues to the next item instead of unwinding the whole run. A summary at the end names any item that could not be completed.
- Solution completeness stays as built (`solutionCompletenessStandard.ts` + `callAIRich` token escalation in `supabase/functions/notebook-ai/index.ts`); if the gate is what is ending runs, the fix is to contain the failure per item, not to weaken the gate.
- Diagram alignment stays as built (`sessionLayout.ts` band reservation, `geometryStandard.ts` ownership rule); verified on the real cyclic-quadrilateral figures and corrected only if something still overlaps.

Untouched: pedagogy reference, QUESTION_LOCK, rendering standard, smartboard, building work, styling.

## Verification

Typecheck, existing lesson-note tests, and a full authenticated run of the 3 + 4 structure end to end — then a read of every item on the finished page for a cut-off solution, a missing answer line, an overlapping figure or broken numbering.
