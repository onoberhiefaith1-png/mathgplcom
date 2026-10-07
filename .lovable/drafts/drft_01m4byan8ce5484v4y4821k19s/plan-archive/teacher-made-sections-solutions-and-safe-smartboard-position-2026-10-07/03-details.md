## 4. Smartboard follows your Sections
- Next and Previous step through your own Sections in order. A Solution opens inside its Section and is never its own stop.
- The old fixed section list is no longer used on the Smartboard.

## 5. Smartboard positioning
- A hidden line sits directly under the Solution. It is the same colour as the board, so you cannot see it. Notes, floating numbers, the writing caret and anything else that floats always stay below it. If something would land above the line, it is moved down.
- Line 1 notes always show, even when Line 1 has no floating numbers. Before, they could disappear, sit above the Solution, or get in the way of the first floating numbers.
- When a lot of floating numbers appear, the board moves them into the free space and never into the Solution.
- When a placeholder appears, the writing caret moves into it straight away. You can still drag the caret out of it afterwards.

## Checks
- Automatic tests: Sections can have any name; a Solution belongs to the Section above it; Next and Previous skip Solutions; nothing is placed above the boundary line; Line 1 notes appear with no floating numbers; the caret moves into a new placeholder.
- After that, a signed-in run of your Part 25 and Part 26 checks in the app.

## Technical details
- `DocumentEditor.tsx`: remove the six-section shell seeding. Add a SECTION toggle (a storedMark/flag that turns typed blocks into `sectionHeading`) and a SOLUTION insert that reuses the current Solution package command at the selection.
- New `src/lib/lessonnotes/sectionTree.ts`: build Sections from `sectionHeading` nodes (or level-1/2 headings in older notes) plus Solution children by document position. `SectionNav`, `lessonOutline.ts`, `autoNumber.ts` and the Smartboard section list read from it. `detectSectionKind` is used only for styling hints, never to decide what counts as a Section.
- Smartboard: compute `marginY = solutionBottom + gap`. Clamp every floating overlay, note, the `WritingSensor` and the free-write caret to `y >= marginY`. Give Line 1 notes their own anchor at marginY. Add a placeholder-mount effect that moves the caret into it once.
- The Floating Numbers code and the Solution package internals are not changed.
