# Every Solution: bold heading with AI, Assign and Floating buttons

## What is wrong (confirmed in this note)
- The Examples in this note are one level deeper than usual (Example = level 3), so each Solution was placed one level below that (level 4).
- The Solution heading only draws its bold style and its buttons (AI, Assign, Floating "#") up to level 3. A level-4 Solution is drawn as plain text with no buttons, which is what the screenshot shows.
- In "Solution 1", the words "ai assign floating" are now part of the heading's actual text, which is why they overlap the first line.

## Fix
1. **Solutions are recognised at any depth.** A heading reading "Solution", "Solution 2", "Solution to Example 3", etc. is always treated as a Solution, whether it sits at level 2, 3, 4 or deeper. So it always gets:
   - bold heading style, same as before
   - the AI, Assign and Floating (#) buttons, linked to its own question
2. **Solution depth is capped.** New Solutions (from AI Edit, Co-Pilot, the "+" button and Restructure) go one level below their question, but never deeper than the levels the editor draws with buttons. Notes that already have deep Solutions are fixed when they open, without losing any content.
3. **Stray button words are cleaned off.** When a note opens, button words stuck to the end of a Solution heading (like "ai assign floating") are removed, e.g. "Solution 1 ai assign floating" becomes "Solution 1". Nothing else in the heading changes.
4. **The sections bar stays one tab per question.** Solutions stay attached to their Example and don't appear as separate sections again.
5. **Guard so it can't be skipped again.** A single shared check decides "is this a Solution?", used by the heading display, the save step, AI Edit and Co-Pilot, so none of them can disagree.

## Checks
- Tests: Solutions at levels 2, 3 and 4 all get the Solution role and their buttons, and deep Solutions are raised to at most level 4 on open. "Solution 1 ai assign floating" is cleaned to "Solution 1". The sections bar shows no Solution tabs.
- Open this note in the browser and confirm every Solution is bold and shows AI, Assign and Floating, and that clicking Floating opens that question's Floating Numbers.

## Technical details
- `src/components/lessonnotes/extensions/SectionHeading.tsx`: `role = level <= 3 ? headingRole(...) : null` blocks level 4. Allow Solution role up to level 6 (`structuralHeadingKind` Solution check first). Add 4 to the extension `levels` so h4 is kept as a heading, and add bold h4 Solution styling that matches h3.
- Solution-depth cap (max 4) and heading-text cleanup (`/\s+(ai|assign|floating|#)(\s+(ai|assign|floating|#))*\s*$/i` on Solution headings only) run in the open-time document repair in `DocumentEditor.tsx` / `questionPairs.ts`. `ownerQuestionId` links are kept.
- Sections-bar source: ignore Solution headings of any level.
- Tests added next to `questionPairs.test.ts` / `solutionNeverDisappears.test.ts`.
