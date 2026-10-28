# Fix Video Adventure → Link to Adventure traversal

## What I verified in the code

The traversal itself already walks Learning Points (`LinkAdventureDialog.pickGame` maps over `canvas.scenes` and calls `questionBarsOf` per scene). So the list is not empty because bars are read from the wrong level — it is empty (or never reached) because of two gates in front of it:

1. **Hard stop before the list renders.** `pickGame` calls `checkpointsMissingTime(canvas)` and, if any Learning Point has no Time duration set, it shows the toast "Set a time for every Learning Point" and returns — the dialog never advances to the bar step at all. That is exactly the screenshot: the game is selected, the toast fires, no bars appear.
2. **Learning Points with only one bar vanish silently.** `questionBarsOf` treats the first Progress Bar of a Learning Point as the reserved Time Bar, and `pickGame` then drops any group whose remaining list is empty. A Learning Point authored with a single bar therefore disappears with no explanation, and if every Learning Point is like that the empty-state message appears.

## The fix

**1. Stop blocking the traversal on missing durations.**
Remove the early `return` in `pickGame`. Always collect and display the bars. Missing durations become an inline, per-Learning-Point notice ("No time set") plus one banner at the top of the bar step, not a dead end. The duration requirement stays enforced where it belongs — at publishing (`checkpointsMissingTime` is already used by the publish guard).

**2. Traverse explicitly and keep every Learning Point visible.**
Rewrite the collection step as an explicit, ordered walk over Learning Points, using video play order (`checkpointsOf`) for Video Adventures and scene order for Static:

```text
Video Adventure
  → for each Learning Point (loop order)
      → reserved Time Progress Bar        (skip)
      → every remaining Progress Bar      (collect)
  → flat, grouped list for the dialog
```

Learning Points are always rendered as a group header, even when they contribute zero question bars; those show a short row explaining that the only bar there is the reserved Time Bar and that another Progress Bar must be added in the editor. The teacher can see the whole structure instead of an empty panel.

**3. Reserved-bar detection tightened.**
Prefer an explicitly-roled Time Bar; fall back to the first Progress Bar in the Learning Point only when no bar carries the role. Position-based fallback stays scene-scoped (never adventure-wide), so a Learning Point's second/third bars are always linkable.

**4. Empty-state message becomes accurate.**
The "no Question Progress Bars" panel only shows when the adventure genuinely has no bars beyond reserved Time Bars, and it names which Learning Points need one.

## Technical notes

- Files: `src/components/adventures/LinkAdventureDialog.tsx` (traversal + rendering + removal of the blocking toast), `src/lib/adventures/barLinks.ts` (shared traversal helper `collectLinkableBars(canvas)` returning `{ sceneId, label, timeBarId, bars, hasTime }[]`), `src/lib/games/types.ts` (only if the reserved-bar helper needs the explicit-role preference).
- No schema or migration changes; assignment/occupancy and Unassign logic stay as they are.
- Publishing guard and the `VIDEO_TIME_REQUIRED_MESSAGE` copy remain, moved out of the linking path.
