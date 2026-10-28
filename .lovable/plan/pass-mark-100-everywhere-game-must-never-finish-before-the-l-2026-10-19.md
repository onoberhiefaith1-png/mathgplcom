# Pass mark 100% everywhere + Game must never finish before the last line

## What was found
- One database table still sets new pass marks to **70%** by default (game assignments). Old rows saved at 70 keep 70.
- The Game marks a question done when the board says the *current* line is solved and every required line is in its "awarded" list. Lines can enter that list without the student writing them: the auto-award when an answer is mathematically equivalent, and the predictive "route complete" award. Solving the second-to-last line (e.g. `x = 15 - 7`) can make the engine treat the last line (`x = 8`) as reached too, so the question closes. This is the most likely cause; step 1 confirms it before changing anything.
- In Academia Adventure the pass check runs on the marks for the whole learning point (good, this is what you asked for), but it releases the loop the moment that total reaches the pass mark, even partway through a question.

## What will change
1. **Confirm the cause first.** Add a test that replays your "one unknow" question (3 lines, 4 marks each): solve lines 1 and 2 only, and check whether line 3 gets awarded. Fix whichever path awards it.
2. **A line counts only when the student wrote that line.** Auto-award and predictive award apply only to the line the student is on, and only when there is writing on that line. They never award a later line.
3. **The last line is always required.** A question finishes only when every line, including the last, has been checked and awarded.
4. **Pass mark 100% everywhere by default.** Change the 70% database default to 100, and reset every saved pass mark (Game assignments, Adventure progress bars, Academia Adventure learning points) to 100. You can lower any of them again afterwards.
5. **Academia Adventure pass rule stays combined.** The pass mark is a share of the total marks of all questions in the learning point (30 + 30 + 40: scoring 30, 30, 10 = 70 passes at 70%). At 100%, every line of every question must be solved. Students can leave a question unfinished and go to the next one.
6. Tests for each rule: last line required, 100% default, combined 70% example from your message.

## Technical details
- `PresentationView.tsx` `awardIfPredictivelyComplete` / `resolveGradableLine` fallback, `ImaginePlayPage.tsx` INSTANT AWARD effect: restrict to `activeLineId` with non-empty ink.
- `useGameRuntime.ts` `acceptLineAward`: reject a line id that isn't the active line.
- Migration: `ALTER ... pass_percentage SET DEFAULT 100`; `UPDATE` pass_percentage / pass_pct = 100 across game assignments, adventure board pass_pct, `academia_adventure_points`.
- Tests in `src/lib/game/runtime/__tests__` and `src/lib/academia/__tests__/adventurePlay.test.ts`.
- Game lock: these are Game file changes; I'll treat your request as the unlock for this fix only.
