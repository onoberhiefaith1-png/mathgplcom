## Implementation

1. **Unify the visible origin**
   - Give the structured-mathematics display the same local origin, width and height contract already used by the writing surface.
   - Remove the extra nested transform that allows its visible HTML to diverge from the physical panel.

2. **Make containment deterministic**
   - Measure the actual structured equation without clipping the evidence needed by containment.
   - Clamp or fit an oversized equation within the surface instead of shifting it beyond either edge.
   - Keep the bounded settle logic so text measurement cannot restart the previous resize loop.

3. **Keep the Text action effective**
   - Ensure clicking **Text** clears any live correction and immediately recomputes all line placement from the Game’s current text settings.
   - Do not rename or alter Reset.

4. **Regression coverage**
   - Add checks for left-, centre- and right-aligned structured questions, including a long equation and the exact left-edge failure shown.
   - Check that repeated measurements settle and do not trigger an update loop.
   - Verify the affected Game in Play at the current wide viewport and a phone viewport; confirm the equation, working and notes remain inside each surface before reporting completion.

## Unchanged

Floating Numbers, grading, question timing, rewards, sound, Reset, saved teacher designs and the canonical line rules will not be modified.
