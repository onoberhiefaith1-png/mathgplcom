# Clean rebuild of Game writing placement

## Confirmed cause

This is not a small visual defect. Three positioning rules are still competing:

- Each line can restore its own saved `indent`, so line two can return to an old sideways position after line one looked correct.
- The renderer still applies left/centre/right alignment inside the writing box, then the measurement guard may convert its correction into another saved indent.
- The guide's X-position includes each surface's own fold and padding. Different scroll pieces therefore draw slightly different segments instead of one straight shared reference.

That is why the first character can be clipped behind the line and why another line appears to “return” to the old position.

## Rebuild outcome

- Remove the current horizontal placement and correction chain rather than patching it again.
- Keep the room, scroll artwork, text appearance, rewards, controls, Floating Numbers and Game behaviour unchanged.
- Establish one scroll-level `contentMarginX`, independent of folds, curves, surface width, previous text position and alignment.
- Draw the visible guide as one perfectly straight vertical line at that X-coordinate.
- Give every line one derived content start: `contentMarginX + one-character gap`.
- Default Question/Line 0 and every working line to that exact start. Old unexplained sideways offsets are discarded.
- Permit indentation only through an explicit future/user indentation action; automatic measurement can never manufacture or save indentation.
- Make the right edge grow or contract from measured content while the left edge remains fixed.
