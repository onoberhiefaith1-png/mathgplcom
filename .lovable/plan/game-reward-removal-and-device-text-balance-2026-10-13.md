# Game reward removal and device text balance

## What will change

### 1. Remove misplaced rewards while editing
- Double-click a placed reward to reveal a small X beside that reward. On phones and tablets, double-tap does the same.
- Clicking the X removes only that reward from its writing surface, through the existing Game editing and saving flow.
- Keep the X easy to tap and accessible by keyboard. Hide it when another reward or the background is selected.
- These controls appear only in the editor. Playing, collecting rewards, animations and sounds remain unchanged.

### 2. Improve phone and tablet writing
- Keep the separate Desktop, Tablet and Mobile text-size settings, as you selected.
- Vertically center text within the usable paper area, including wrapped lines, rather than letting it sit against the top decoration.
- Balance the writing surface’s height and internal spacing with the selected text size so mobile and tablet retain the desktop’s visual relationship between writing and paper.
- Make phone and tablet writing more substantial and readable without changing the saved desktop appearance or overwriting device size settings.
- Keep equations, fractions, roots, powers and notes inside the writing area. Allow the surface to grow when content requires more room.
- Preserve the existing margin adjustment, independent size sliders and proportional shrinking at small sizes.

## Verified starting point
- `ImagineStage.tsx` currently renders placed rewards as non-interactive images, so they have no direct removal control.
- `ImagineEditorPage.tsx` adds rewards to the selected slot and already saves Game edits through the existing save flow.
- Writing regions align their contents centrally, but the outer surfaces use fixed/minimum heights and padding independently of that inner region. Correcting the full usable-area layout is necessary; centering the inner text alone is insufficient.
- `responsiveSize.ts` already selects independently saved sizes and scales the complete non-table surface below each device’s size midpoint.

## Technical scope
- Add editor-only reward selection/removal callbacks to the shared Game stage and connect them to slot updates in the editor.
- Adjust the non-table writing layout and device-aware spacing in `ImagineStage.tsx` and its styles. Use shared pure geometry helpers if proportional sizing requires calculations.
- Preserve Game Pro, table surfaces, Floating Numbers behavior, grading, teaching content, saved media and unrelated work.
- No database changes, MCP changes, publishing or deployment.

## Verification
- Add focused tests for removing exactly one reward, keeping other slots/rewards intact, and preserving independent device sizes and proportional geometry.
- Check double-click/double-tap removal and confirm that controls are absent during play.
- Compare the same writing content on desktop, phone and tablet in both editing and playing views, including short text, wrapped text and structured mathematics at small and large sizes.
- Check that text is vertically centered, remains inside the paper, and does not overlap rewards or frame decorations.
- Verify removal survives saving and reopening using an authorized test Game; report any unavailable signed-in checks rather than claiming them complete.
- Run relevant tests and inspect preview errors before reporting results.