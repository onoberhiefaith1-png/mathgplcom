# Keep Example and Solution together, permanently

## The problem

In the note, a Solution belonging to Example 2 ended up sitting below Example 3, so Example 3 shows two "Solution 3" blocks — one of which is really Example 2's working. The pair broke apart because a Solution can now be written into ordinary document flow at the vertical spot the teacher clicked, and that spot can fall past the next Example heading. Nothing currently stops a Solution from landing outside the Example that owns it.

No revert. The fix is a rule added on top of the current version, so everything else you have corrected stays.

## The rule to enforce

- Every Example (or Exercise/Question-style section) and its Solution are one unit.
- A Solution always lives inside its own Example's block: after the question body, before the next Example heading.
- The teacher can still write the Example content manually, add lines, and edit freely inside the pair.
- A Solution can never be created, moved, or typed into a position that belongs to a different Example.
- The Solution label always follows its owner's number (Example 3 → Solution 3), so a stray "Solution 3" under the wrong Example cannot appear.
- Diagrams are unaffected: they stay free to be drawn and overlapped anywhere.

## What will change

1. Solution creation is clamped to its owner
   Any path that inserts a Solution (Solution button, AI generation, blank-space click, manual insert) resolves the owning Example heading first and clamps the insertion inside that Example's range. If the click point falls past the next Example heading, the Solution is placed at the end of its own Example instead of the clicked spot.

2. One Solution per Example
   Before inserting, the editor looks up an existing Solution owned by that Example (by owner id, document-wide) and reuses it rather than creating a second one.

3. Ownership stamped and kept
   Each Solution heading carries its owner Example's id at creation. Label numbering is derived from the owner, so headings cannot drift out of sync after inserting or deleting Examples.

4. Self-healing pass on note open/save
   When a note loads (and before it saves), a repair pass finds Solutions whose position no longer matches their owner Example and moves them back under that Example, keeping their content untouched. This heals the note in your screenshot without deleting anything.

5. Guard against drag/typing across the boundary
   Moving a caret or dragging a Solution block outside its Example snaps it back into the pair, so the split cannot be reintroduced by hand.

## Not changed

- Diagram free placement and overlap.
- Question/Solution wording, AI generation content, floating numbers, assignments, grading.
- Existing content: nothing is deleted; misplaced solutions are relocated, not removed.

## Technical notes

- Extend `src/lib/lessonnotes/containerRange.ts` with `solutionRangeForQuestion` and `clampSolutionInsert`, built on the existing `sectionEndWithin` / `ownerQuestionHeadingFor` / `ensureOwnerQuestionId` helpers.
- In `src/components/lessonnotes/DocumentEditor.tsx`: route Solution insertions in `createFreeFrame`, `insertAtSensor`, `insertSection` and the Solution branch of `handleSectionAi` through the new clamp; keep `findSolutionHeading` as the single reuse lookup.
- Add a `reconcileSolutionOwnership(doc)` transform used on editor init and before `syncDocumentToNotebook`, moving owned Solution blocks to the end of their owner's section and renumbering labels from `lessonOutline`.
- Tests added to `src/lib/lessonnotes/__tests__/solutionOwnership.test.ts`: a Solution clicked below the next Example stays with its owner; a document with a misplaced Solution is reconciled; diagrams keep free positions.
