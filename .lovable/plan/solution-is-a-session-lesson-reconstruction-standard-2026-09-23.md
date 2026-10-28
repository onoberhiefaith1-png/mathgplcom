# Solution Is a Session: Lesson Reconstruction Standard

## Goal
Whenever AI Edit (or the Co-Pilot) structures or rebuilds a lesson, every question that needs a solution is followed by its own separate Solution session, numbered to match, so the Smartboard can step Question → Solution.

```text
Introduction → Explanation →
Example 1 → Solution 1 → Example 2 → Solution 2 →
Classwork 1 → Solution 1 → ... → Classwork 6 → Solution 6 →
Homework 1 → Solution 1 → ... → Homework 5 → Solution 5 →
Summary
```

## What will change

1. **New reconstruction rule for the AI**
   A written standard added to AI Edit and Co-Pilot generation covering: understand → identify → rebuild missing headings → match each question to its solution (even if it sits elsewhere) → improve wording without changing the maths → create missing solutions → separate → validate. Includes detecting questions and solutions that have no labels, splitting grouped "Q1 Q2 Q3 / Sol1 Sol2 Sol3" blocks into pairs, and rebuilding a lesson whose headings were all deleted. Explanations stay without a solution.

2. **Automatic self-check before anything is shown**
   A structure checker reads the AI's draft as a list of sessions and rejects it when:
   - a Classwork/Example/Homework/Exercise question has no Solution session straight after it;
   - a question and its working sit inside the same session;
   - all questions come first and all solutions after;
   - numbering does not match (Classwork 2 → Solution 7);
   - an existing teacher solution was dropped or regenerated instead of moved.
   On failure the AI gets one targeted retry; anything still wrong appears in the review note.

3. **Real Solution sessions in the note**
   On Accept, each "Solution N" becomes a genuine Solution section tied to its question (the same linked kind the editor already uses), not text inside the question. Existing numbering and ownership rules keep Solution N attached to question N.

4. **Repair for existing notes**
   A "Fix lesson structure" action in AI Edit runs the same checker on a whole note, shows a preview of the new session order, and on Accept splits merged question+solution sessions and adds missing Solution sessions. Nothing is deleted.

5. **Upscale summary**
   The pop-up after each edit adds "paired X questions with solutions, created Y missing solutions".

## Not changed
AI Edit's two entry paths, panel design, QUESTION_LOCK, one micro-step per line, Floating Numbers, diagrams.

## Technical notes
- New `supabase/functions/notebook-ai/sessionStructureStandard.ts` injected after UPSCALING_STANDARD in the edit prompt and in section/lesson generation prompts.
- New pure `sessionStructureVerifier.ts` (parse heading sequence → kinds via `detectSectionKind` logic; return defects); merged into the existing upscale retry loop in `index.ts`. Report line gains `paired="n" solutionsCreated="n"`.
- Client materialization (`aiTextToNodes` / accept path in `DocumentEditor.tsx`): "Solution N" headings become `solution` kind headings stamped with the owner question id via `ensureOwnerQuestionId`; reuse `reconcileSolutionOwnership`.
- Tests: grouped Q/S split, missing solution created, headless lesson rebuilt, mismatched numbering rejected, explanation not given a solution, existing solution moved not regenerated.
- Deploy `notebook-ai`, then one live compose test with a headless statistics lesson.
