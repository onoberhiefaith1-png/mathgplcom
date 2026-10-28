# Compact Game writing surfaces

## Requested changes
- Remove only the new reward scrolling bar; keep the text-size controls.
- Restore rewards’ previous screen appearance and spacing, without making writing surfaces grow to accommodate them.
- Keep editor-only reward removal, with a clearly visible cross beside the selected reward. Investigate the delayed response and make selection/removal feel immediate without accidental deletion.
- Restore compact horizontal writing surfaces on phone and tablet: the frame should closely enclose centered, readable text rather than resemble a tall standing board.
- Aim to show four or five ordinary single-line surfaces together, where the available screen height permits. Longer questions and multi-line mathematics must remain fully visible and may need more space.

## Confirmed layout issue
The current surface padding includes a measured reward-band height, applied above and below the writing. The mobile growing-surface minimum width is also much narrower than desktop. These settings can produce unnecessary height and wrapping; rewards should not determine writing-space dimensions.

## Technical changes
- In `ImagineStage.tsx`, remove reward-band measurement from non-table surface sizing and remove the editor reward overflow strip. Preserve saved reward locations and deletion’s mapping back to saved pattern slots.
- In `EditorReward.tsx`, restore compact reward spacing while keeping the cross separate from the reward tap target; check touch and mouse event timing.
- In `src/styles.css`, reduce surplus vertical space and use available horizontal room before wrapping. Keep desktop proportions as the reference, existing independent device size settings, frame artwork and text centering.
- Leave Game tables, Game Pro, Floating Numbers, scoring, saved teaching content and unrelated integration work unchanged.

## Verification
- Compare the same existing Game on desktop, phone and tablet, using the annotated screenshot as the problem reference.
- Check short equations, long text, fractions and powers for containment and centered writing; measure how many compact lines fit at the current phone height and a taller phone height.
- Verify double-click/double-tap reveals the cross promptly, removal persists after reopening, other rewards remain, and no removal controls appear during play.
- Run relevant Game regression tests and inspect automatic build results. Leave changes unpublished.