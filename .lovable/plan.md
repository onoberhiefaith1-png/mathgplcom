## Long Division — usability fixes

All changes are contained in `src/components/lessonnotes/extensions/visuals/arithmetic/LongDivision.tsx` plus a small tweak to the hover-idle hook. No changes to `src/lib/division.ts` or other assets.

### 1. Inline divisor input (left of the ")" bracket)

Right now the divisor can only be edited from the right-hand panel, so there's nowhere on the board to type `35` before the bracket. Replace the read-only `<span>{m.divisor}</span>` in the bracket row with a real `<input>`:

- Auto-sized to its content (`width: ${max(1, m.divisor.length)}ch`, min ~1.5ch).
- Same font, color, transparent background, no border.
- Right-aligned so the bracket sits flush against the last divisor character.
- Accepts letters/digits/`.` `,` `-` (same permissive set as the cells — see §4).
- Keeps the right-hand panel "Divisor" field as an alternative editor; both stay in sync via `patch({ divisor })`.

Focus behaviour: clicking the space just left of the ")" focuses this input. Pressing `ArrowRight` at end-of-text jumps into the dividend's first cell; pressing `Backspace` on an empty divisor does nothing (does not delete columns).

### 2. Vinculum (top bar) always visible as a complete structure

Currently the top bar is drawn per-cell (`borderTop` on each dividend cell), so before any digits are typed there are zero cells and no bar appears — the structure looks incomplete.

Fix:

- Ensure the dividend always has at least `MIN_COLS = 3` cells on first mount (bump from 1 to 3) so the bar has visible width from the start.
- Draw the vinculum as **one continuous element** that spans the whole dividend region, not per cell. Implementation: wrap the dividend cells in a single grid container whose `borderTop` provides the bar; the cells sit under that shared bar. This guarantees the line is unbroken and expands automatically as columns are appended.
- The bar visually connects to the top of the ")" bracket (small negative left offset so it meets the bracket's inner curve).

### 3. Allow letters as well as digits

Change the accepted-key regex in `DigitCell` from `/[0-9.,\-]/` to `/^[\p{L}\p{N}.,\-]$/u` so any single letter or digit (including unicode) types into a cell. Also:

- Remove `inputMode="numeric"` (or set to `"text"`) so mobile keyboards show letters.
- Space still advances one column without writing (unchanged).
- Backspace behaviour unchanged.

Same permissive set is applied to the inline divisor input.

### 4. Easier-to-summon bottom toolbar ("the sensor")

Two changes make it much easier to trigger and keep open:

- **Larger hit area:** render a ~28px tall transparent hover strip directly under the asset (part of the toolbar wrapper, not the buttons) so the pointer doesn't have to land exactly on the small pill.
- **Shorter reveal delay + longer idle window:** update `useHoverIdleVisibility` so the toolbar appears on `pointerenter` immediately (no debounce) and the idle-hide timer is reset by *any* pointer movement inside the asset root, not just movement over the toolbar itself. Idle timeout stays at 10s.
- Keep force-visible while the asset is selected (unchanged).

### Out of scope

- No auto-computed quotient/product/remainder — teacher-typed only.
- LCM/HCF ladder and other tabular assets unchanged.
- No visible column gridlines.
