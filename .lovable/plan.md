## Problem

In the current math renderer, when you type `x#2` (superscript) or `x##n` (subscript), the digit/letter appears far to the right of the base (`x`). The teacher wants the script to sit right next to the base — as if there were a single vertical boundary line just after the base, and the script starts at that line.

Root cause is purely CSS in `src/index.css`:

- `.math-slot` has `min-width: 0.82em` and horizontal `padding: 0 2px`. Both the base slot AND the script slot get this, so between `x` and `2` you accumulate ~4px padding on each side plus a forced 0.82em floor on the (small) script slot.
- `.math-struct` itself has `padding: 0 2px`, adding another gap around the whole structure.
- `.math-struct--power`, `.math-struct--sub`, `.math-struct--subsup` don't override these, so the gap is very visible with small script content.

## Fix (CSS-only, no logic changes)

Edit `src/index.css` only:

1. Remove horizontal padding from the base and script slots inside `power`, `sub`, and `subsup`; keep vertical room for the caret via min-height only.
2. Drop `min-width` on the script slot so a single digit sits flush against the boundary; keep a tiny min-width only when the slot is empty and focused (so the ▯ placeholder still has room).
3. Tighten `.math-struct` outer padding for these three kinds so the whole node hugs surrounding prose.
4. Nudge script `transform: translate` values so the script visually starts at the right edge of the base's character box (a small negative `margin-left` on the script slot, e.g. `-0.05em`), giving the "boundary line just after x" look the user described.

Nothing else changes — the tree model, the `#` / `##` shortcuts, navigation, and validator all stay as-is.

## Verification

- Re-render the two examples in the screenshot (`2x²`, `xₙ`, and the nested `x^{2^{5^n}}` case).
- Confirm visually with a Playwright screenshot that the script hugs the base with no visible horizontal gap, and that empty focused slots still show the ▯ placeholder at a usable size.
- Confirm the caret can still be placed inside empty script slots.
