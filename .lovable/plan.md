## Long-division as a single symbol (like √)

**Problem:** Right now the symbol is drawn as two pieces — a text `)` character next to a separate CSS top-border for the overbar. They don't visually connect, so it reads as "divisor ) …" plus a floating line.

**Goal:** One continuous glyph, same idea as the square-root radical: a curved left hook that flows into the horizontal vinculum stretching over the dividend, expanding as more digits are added. The divisor sits **outside** the symbol on the left (the symbol borrows only the expression the way √ does).

### Fix (LongDivision.tsx only)

1. **Delete the text `)` and the separate `borderTop` vinculum.** Replace them with a single inline SVG "radical-style" long-division bracket:
   - `<svg>` sized as `height = rowHeight`, `width = nCols * cellWidth + hookWidth`.
   - A single `<path>` draws: start at bottom-left of the hook, curve up-and-right into the top-left corner, then a straight horizontal line across the full dividend span. Stroke uses `m.lineThickness` and `currentColor`.
   - Rounded stroke caps/joins so the corner reads as one continuous glyph.

2. **Overlay dividend cells under the vinculum.**
   - Wrap the SVG + the dividend digit-cell grid in a `position: relative` container.
   - SVG is `position: absolute; inset: 0; pointer-events: none;` so the digit inputs stay clickable.
   - The digit grid keeps `gridTemplateColumns: repeat(nCols, COL_W)` and sits directly under the horizontal part of the SVG, with padding-top equal to `lineThickness + 2px`.
   - Left padding on the container equals the hook width so digits start just inside the hook, exactly like digits sit under √.

3. **Divisor input stays outside the symbol** (to its left), no `)` character next to it. Same auto-width `ch` sizing, right-aligned, flush to the hook.

4. **Quotient row** keeps its grid alignment above the vinculum (unchanged columns), so each quotient digit still sits directly above its dividend digit.

5. **Working-step rows** keep the same digit-column grid as today, so subtraction and intermediate rows still align perfectly under the dividend.

### Technical details

- New helper component `LongDivBracket({ nCols, colW, hookW, thickness })` returning the SVG. Hook is a quadratic curve, e.g. `M hookW,rowHeight Q 0,rowHeight 0,rowHeight/2 Q 0,0 hookW,0 H hookW + nCols*colW`.
- `COL_W` stays `1.15ch`; convert to px via a measured ref or a fixed `chToPx` estimate for SVG width. Simpler: render SVG with `width: 100%` inside a container whose width is `hookW + nCols * COL_W`, `preserveAspectRatio="none"` on the horizontal segment, but keep the hook portion in fixed px by splitting the SVG into two absolutely-positioned pieces: a fixed-width hook SVG on the left and a full-width top-border line for the vinculum — both share the same stroke so they read as one glyph.

### Out of scope

No changes to quotient logic, working-step rows, keyboard nav, letters-allowed rule, hover-idle toolbar, or other assets.
