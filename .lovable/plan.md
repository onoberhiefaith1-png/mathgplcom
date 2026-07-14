## Merge divisor and `)` bracket in Long Division

**Problem:** In the Long Division asset, the inline divisor input and the `)` bracket are visually separated by a gap, making them look like two disconnected elements instead of one long-division symbol.

**Fix (LongDivision.tsx only):**

1. Remove the gap between the divisor input and the `)` bracket:
   - Shrink the grid gutter that separates them (currently `1.5ch auto ...`) so the divisor sits flush against the bracket.
   - Right-align the divisor input and left-align the `)` so their glyphs touch (small negative letter-spacing / no horizontal padding on either side).
   - Auto-size the divisor input to its content width (via a hidden measuring span or `ch`-based width from `divisor.length`), so a 2-digit divisor like `45` stays tight to `)` without a fixed wide column.

2. Keep everything else unchanged: vinculum, dividend cells, quotient, working-row grid alignment, keyboard nav, letters allowed, toolbar hover strip.

**Out of scope:** No changes to other assets, hooks, or business logic.
