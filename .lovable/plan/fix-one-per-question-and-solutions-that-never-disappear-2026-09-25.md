# Fix: one "+" per question, and Solutions that never disappear

## Problem 1 — two "+" buttons (Example and Solution)
The "+ Add another" button is placed at the end of every repeatable heading. AI Edit writes `Solution 1` at the **same heading level** as `Example 1`, so the editor thinks the Example ends where the Solution starts — one "+" appears under the Example, and another under the Solution. Co-Pilot nests the Solution one level below the question, which is why it looks right there.

Fix:
- A Solution is never its own section. The "+" button is never drawn for a Solution heading.
- A question's section runs through its Solution: the single "+" sits **under the Solution**, and clicking it adds the next `Example N` (with its own empty Solution) below it — exactly as today.
- AI Edit output is normalised before it lands in the note: every `Solution N` heading becomes one level below its question and is stamped with that question's id. AI Edit and Co-Pilot then produce the same structure.
- Existing notes with same-level Solutions are healed the same way when opened.

## Problem 2 — Solution disappears after Proceed / coming back
The note is "repaired" automatically every time it loads. One repair rule **deletes any Solution whose question it cannot find**. It only recognises a question if its heading is level 1–2 and carries a saved question id. When AI Edit output, a plus-created Example, or a reload leaves the question without that id (or at a lower level), the Solution is judged "orphaned" and silently deleted, and the deletion is then saved.

Steps:
1. Confirm the cause first: reproduce (AI Edit generate → Proceed → leave → return) and check the saved note in the database before and after, to confirm which rule removes the Solution and whether the question id survives saving.
2. Stop deleting: a Solution whose owner cannot be found is **re-attached to the nearest question above it**, never removed. Deletion only happens when the teacher deletes the question itself.
3. Make question ids durable: every question heading gets its id when created (AI Edit, Co-Pilot, the "+" button) and keeps it through save/reload.
4. Recognise questions by meaning (Example / Classwork / Exercise / Homework …), not only by heading level.

## Tests
- AI Edit-style note (Example 1 / Solution 1 same level) → exactly one "+", under the Solution.
- Clicking that "+" adds Example 2 + empty Solution below Solution 1.
- Save → reload round-trip keeps every Solution and its content.
- Solution with a missing/stale owner id is re-attached, not dropped.
- Deleting a question still removes its Solution.

## Technical details
- `src/components/lessonnotes/extensions/SectionHeading.tsx` (`buildAddAnotherPlugin`): skip `solution` kind; section end ignores Solution headings owned by the question.
- `src/lib/lessonnotes/questionPairs.ts` (`enforceQuestionSolutionPairs`): replace step 2 "drop orphaned" with re-adopt; broaden `isQuestionHeading` to use `detectSectionKind`; add level normalisation (Solution = question level + 1).
- `src/lib/lessonnotes/solutionPairing.ts`: exclude Solution headings from `isQuestionHeading`.
- AI Edit apply path in `DocumentEditor.tsx` / `aiToNodes.ts`: run the normaliser on inserted content and assign `sectionId` to new question headings; verify `sectionId` / `ownerQuestionId` are persisted in heading HTML/JSON.
- Add vitest cases in `src/lib/lessonnotes/__tests__/solutionOwnership.test.ts`.
