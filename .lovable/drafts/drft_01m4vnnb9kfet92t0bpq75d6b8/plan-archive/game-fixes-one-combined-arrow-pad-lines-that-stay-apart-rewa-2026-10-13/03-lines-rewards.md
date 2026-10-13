## 2. Floating Numbers from different lines are never joined again

**What actually goes wrong.** While a student plays, the board knows which Game line each row of writing belongs to. That knowledge is not saved. When the student comes back, the board rebuilds it by comparing each row with the expected steps. A row that does not match a step (a wrong step, or a step still in progress, like "3y − 5 = 10" on Line 2 in your screenshot) is attached to the line above it. That is how Line 2's work ended up inside Line 1.

**Fix.**
- Save which line every row belongs to, together with the student's work, on every save path: signed-in Game and Academia boards, shared links, the device's own backup copy, and the offline Academia app.
- On return, the saved line ownership is used as it is. Text comparison is not used any more for a board that has it.
- Boards saved before this fix (with no ownership saved) still need rebuilding, so the rebuild rule changes: a row that matches no step goes to the **next free line**, never the line above. It joins the line above only when it is the bottom half of the same fraction or finishes an equation that was split across two rows.
- The result is that every line's Floating Numbers come back on their own line, every time.

## 3. Rewards stay, and they never freeze the Game

The rewards are still in this Game. It has 14 saved rewards: 12 on the first line's pattern and one each on the next two lines. The decorations simply do not appear on screen any more. The likely cause is where the new decoration layer sits, behind or under the surface frames. A reward used before the Game ended may also stay hidden after a restart. Neither is confirmed yet, so the first step is to open this Game and find the real cause before changing anything.

- Rewards show again in the place the teacher put them, in front of the paper and separate from it. They never change the size of the paper.
- They still work fully: coins, hearts, Energy Balls, Collectors, Calculator and Vaults trigger exactly as before.
- The freeze protection stays: each reward plays its effect once, effects run outside the writing, and only a limited number play at the same time. If an effect fails, it is skipped and the Game carries on.
- Restart and "time ran out" bring all unused rewards back for the new attempt.

## How it will be checked

- Tests (each kept in the project):
  - the pad shows the bigger arrow under up and the smaller arrow under down, with no percentage
  - saved line ownership comes back unchanged
  - an unmatched row on Line 2 stays on Line 2
  - a fraction's bottom row stays with its own line
  - rewards from the first line's pattern appear on Line 1
- Playwright at your phone size (393 × 503), on tablet and on desktop:
  - the pad never covers the Floating Numbers
  - write on Lines 1 and 2, leave, come back: both lines are still separate
  - the rewards are visible and an Energy Ball chain runs without the Game freezing

## Technical details

- `SensorDPad` gets an optional Game-only size pair (`onBigger/onSmaller/canBigger/canSmaller`). The grid becomes 5 rows inside the Game, and `padHalf` plus the drag limits come from the real measured height. `ImaginePlayPage` passes `writingScale` through `PresentationView` and deletes its own bottom size group.
- Add `rowOwners` (and an ownership version) to `AssessBoardState`, the smartboard sync/local recovery snapshot, and the offline board store. Restore applies them filtered to rows that still carry ink, and skips `seedGameLineOwners` when they are present.
- `seedGameLineOwners`: an unmatched row advances to the next unclaimed expected line, unless it is a `.5` denominator row or it completes the current line when combined with the row before. Keep the existing tests and add the cases above.
- Rewards: inspect `data-reward-decoration` stacking and zoom against the surface frame, and how `consumedRewardKeys` is reset on restart and after game over. Fix only the confirmed cause. `rewardPresentation` guards stay unchanged.
- Update `AGENTS.md`: the rule for restoring Game rows becomes "ownership is saved; text matching is only for older saves".
