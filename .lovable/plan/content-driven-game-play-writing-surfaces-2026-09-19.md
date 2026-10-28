# Content-driven Game Play writing surfaces

## Goal
Make laptop and desktop writing surfaces grow exactly like the already-correct mobile version.

- The 5% left and 95% right screen positions define the **maximum writing range only**.
- Every surface starts at the 5% left boundary.
- Each surface ends shortly after its own rendered content.
- A short equation creates a short surface.
- A longer solution step creates a wider surface.
- An empty line remains at its compact minimum, cube-like width.
- As more work appears, only that surface expands.
- At the 95% boundary, text wraps and the same surface grows downward.
- Other surfaces keep their own dimensions and move down only when needed to preserve spacing.

## Implementation
1. Remove the desktop rule that forces every Play surface to fill the full 5%–95% band.
2. Use each line's actual rendered text bounds plus the existing small left/right material inset to calculate that surface's width.
3. Clamp each calculated width between the compact empty-surface minimum and the 90%-of-viewport maximum.
4. Keep every Play surface left-anchored at the same 5% viewport position while allowing its right edge to stop after its own content.
5. Keep the text renderer's wrapping width at the 95% boundary so long content wraps before crossing the screen edge.
6. Continue deriving height independently from each line's rendered wrapped content, preserving the existing gap between surfaces.
7. Keep the complete physical surface as the click target so selecting any numbered surface still activates its matching Floating Numbers line.

## Validation
- Empty Surface 2 remains compact.
- Surface 0 ends shortly after `x + 7 = 12`.
- Surface 1 ends shortly after its longer equation rather than at 95%.
- Adding text expands only the active surface horizontally until 95%, then vertically through wrapping.
- Surface spacing remains stable with no overlap.
- Desktop is verified at the current 2050px viewport; mobile behavior remains unchanged.
- Direct surface-to-Floating-Numbers activation remains working after the geometry change.

## Not changing
Game Edit, camera behavior, surface materials, rewards, mathematical evaluation, or the Floating Numbers interface.
