## Restore the Two-Panel Floating Number System (with Auto-Recycle)

### What went wrong

In the last change, `allSlots` was redefined to include **every** fragment of the active line (used + unused) in one rotating list, and the visible strip just renders a window over that list. The dedicated **Used (blue)** zone effectively disappeared into a single rotating queue. The teacher's mental model is two side-by-side panels, not one queue.

### Target behaviour

Two distinct panels, always visible:

```text
┌──── USED (blue) ────┐ ┌──── AVAILABLE (white) ────┐
│  +c    +b    a²     │ │  =    0                   │
└─────────────────────┘ └───────────────────────────┘
   newest → oldest          teacher picks from here
```

Rules:
1. **Available (white)** — chips not yet consumed for the current line. Tapping one consumes it → moves to Used.
2. **Used (blue)** — chips already consumed for the current line, **newest first** (most recent at the left/front). Tapping a used chip returns it to Available (existing un-consume behaviour).
3. **Auto-recycle** — when Available becomes empty, start returning chips from the **oldest end** of Used back into Available, one at a time as the teacher keeps tapping. Recycled chips render as plain white (not blue) and are tappable again. This cycles forever.
4. Both panels stay on screen at all times; they are never merged.

### Implementation (in `src/components/smartboard/FloatingNumberPanel.tsx`)

1. **Split the strip back into two zones.**
   - `availableSlots` = active line's fragments where `absIdx ∉ consumedAbsIdx`, in teacher's saved order.
   - `usedSlots` (newest-first) = `usedOrder` filtered to the active line, then `.reverse()` — this part already works and stays.
   - Render the used zone with the existing blue chip styling; render the available zone with white chip styling.

2. **Remove the "rotation of the full equation" logic.**
   - Revert `allSlots` to be **available-only** (drop the change that included consumed chips).
   - The unused strip rotation (`offset` modulo `availableSlots.length`) keeps working — that part of "infinite cycling" was correct, it just operated on the wrong set.

3. **Add auto-recycle when Available is empty.**
   - When `availableSlots.length === 0` and `usedOrder.length > 0`, expose a "recycle" action that:
     - Pops the **oldest** index from `usedOrder` (front of the array, since `usedOrder` is append-on-tap → oldest-first).
     - Calls the existing parent un-consume handler for that index (same path used when the teacher clicks a blue chip), so it reappears in Available as a normal white chip.
   - Trigger recycle automatically: a `useEffect` that watches `availableSlots.length`. When it drops to 0 and `usedOrder.length > 0`, schedule one recycle. As the teacher continues tapping, each tap empties Available again and the next-oldest used chip recycles, producing the cycle described in the message.
   - Recycled chips carry no "blue/used" flag — they are just available again.

4. **Keep working behaviour untouched.**
   - Click-to-return from Used → Available stays exactly as it is.
   - Most-recent-first ordering in the Used zone stays.
   - Non-cursor halo, notebook-checkpoint gating, equation-first ordering, teacher-chip immutability — none of these are touched.

### Verification

- Sequence `a², +b, +c, =, 0` with five taps empties Available; the 6th tap recycles `a²` back to Available as white; subsequent taps recycle `+b`, then `+c`, …
- Tapping a blue chip in Used still returns it directly to Available (manual undo).
- Used zone always shows newest tap leftmost.
- No change to lesson-note rendering, presentation gating, or chip content.

### Files touched

- `src/components/smartboard/FloatingNumberPanel.tsx` (only file)
