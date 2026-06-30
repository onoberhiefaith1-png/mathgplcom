## Goal
Fix only the movement logic inside `FloatingNumberPanel.tsx`. Do not change the visual design, layout, controls, icons, colors, spacing, or chip styling. The blue used zone, the 5-slot window, and the chevrons stay exactly as they are today.

The strip must behave as ONE continuous circular conveyor:

```
[ Blue Used (scrollable) ] | [ 5 visible slots ] | [ Hidden right queue ]
        newest → oldest                                next → later
```

## Required movement behavior

1. **Always exactly 5 visible chips.** If the source has fewer than 5 unique unused chips, repeat them (`a a a a a`, `x y x y x`) by modular indexing.
2. **Tap an unused chip → conveyor shifts left by 1.**
   - The tapped chip becomes the NEW newest entry of the blue zone (placed at the far-left end of blue, next to all older used chips).
   - The next chip in the teacher's saved order slides into the right edge of the visible window.
   - The tapped chip must NOT reappear inside the visible 5 until the rotation has cycled through every other chip first.
3. **Hidden right queue → blue rotation.** When the right queue is exhausted, pull the OLDEST blue chip (far-left of blue) back onto the right side of the visible window, stripped of its blue state (renders as plain white again). The ring never ends and the 5 slots never go empty.
4. **Backward chevron (◀)** scrolls the window left, revealing blue chips inside the visible 5 (newest first), exactly as it does today. Tapping a revealed blue chip returns it to the unused flow (current behavior preserved).
5. **Forward chevron (▶)** hides any revealed blue chips first, then advances the right queue, looping forever.
6. **Newest-used ordering** in blue: newest sits at the far-left end of the strip; older ones extend further left (matches current `revealedUsed.reverse()`).

## Technical changes (single file: `src/components/smartboard/FloatingNumberPanel.tsx`)

- Introduce a derived `remaining` list = `allSlots` filtered to NOT-consumed, in original teacher order. Keep `allSlots` for the ring fallback.
- Rebuild `windowSlots`:
  - Left part: `revealedUsed.slice(0, clampedReveal)` as today.
  - Right part: fill `WINDOW_SIZE − clampedReveal` slots by modular walk over `remaining` (so consumed chips are skipped from the natural flow).
  - If `remaining.length === 0`, fall back to a modular walk over `allSlots` rendered with `used: false` (the "blue rotating back as white" case).
- `handleActiveTap`: after marking the chip consumed, advance `offset` so that the consumed chip's successor (in teacher order) becomes the new leftmost visible chip. Keep `setReveal(0)`.
- `goForward` / `goBackward`: keep current reveal-then-rotate semantics, but rotate over `remaining` when non-empty, else `allSlots`. Wrap with modulo so it never stalls.
- Keep all JSX, styles, dimensions, icons, halos, line badges, notebook button, drag grip, freezing/gating, fraction rendering, and tap handlers unchanged.

## Out of scope
No edits to `presentation.ts`, `floatingPlan.ts`, `FloatingDisplayStrip.tsx`, `FloatingMath.tsx`, CSS, or any other file. No new components, no new props, no design tweaks.

## Verification
- Manually drive a 5-chip equation in the live preview: tap leftmost chip → confirm tapped chip jumps to blue (far-left), remaining 4 slide left, 5th unused appears on right.
- Tap until right queue empty → confirm oldest blue chip cycles back to right side as plain white, window stays at 5.
- Single-token reservoir (`a`) → confirm the visible 5 shows `a a a a a` and rotates without going empty.
- Backward/forward chevrons still reveal/hide blue chips with no layout change.