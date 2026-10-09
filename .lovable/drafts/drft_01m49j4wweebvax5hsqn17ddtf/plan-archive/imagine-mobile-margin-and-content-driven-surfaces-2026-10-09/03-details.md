## Interaction details

1. On phones, give the margin line a touch-friendly invisible grab area while keeping the visible rule slim.
2. During a drag, convert the pointer position into the same saved content-margin value already used by the Game. Clamp the minimum so the number strip plus margin occupies 5% of that surface, and clamp the maximum so useful writing width always remains.
3. Size and position the number label from that same value. The label scales only within readable limits; it does not overlap the margin or mathematics.
4. Start mathematics immediately after a small character-sized gap. Remove the current fixed three-rem offset on mobile, because it prevents reclaimed space from becoming writable.
5. Measure each line’s rendered mathematics independently. Its surface width follows measured content plus the number strip, margin, gap and end padding; width is capped by the available board width. Once capped, text wraps and height grows.
6. Preserve a fixed left edge and content-driven right edge. For a scroll, the left rod stays fixed while the right rod moves with the surface edge.

## Technical details

- Keep the work inside Imagine’s DOM/CSS stage and its existing settings/state flow.
- Reuse the Game’s margin clamping and content-gap principles, but apply the new 5%-of-surface mobile minimum.
- Use pointer events for both touch and mouse dragging; prevent accidental line selection only while the handle is being dragged.
- Keep desktop classes and measurements unchanged behind the phone breakpoint.
- Add focused layout tests for the 5% minimum, reclaimed width, independent growth, maximum-width wrapping and text-size-driven growth.

## Verification

Test in the actual Imagine play page at phone width:

- drag the line nearly to the left edge and back;
- confirm Q/number labels contract and remain readable;
- confirm the mathematics visibly gains the released width;
- enter short, long and large-size mathematics and confirm each surface grows independently;
- confirm long mathematics wraps only at the board limit and never leaves its surface;
- confirm the scroll’s right roll follows growth;
- confirm desktop Imagine and the original Game have not changed.