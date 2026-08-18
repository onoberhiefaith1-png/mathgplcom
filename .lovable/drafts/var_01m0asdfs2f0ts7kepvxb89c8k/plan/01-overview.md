# Square root must never collide with an exponent

In the screenshot, `σ = √((x − µ)² / N)` draws the `²` on top of the radical's overline: the exponent crosses the bar instead of sitting under it.

## Why it happens (verified)

In `src/lib/notebook/mathRender.ts`:

- The radical (`connectedRadical`, lines 43-105) is an inline-flex: a stretched SVG hook plus a "bar" span whose `borderTop` is the overline. The bar has a fixed `paddingTop: 1px`, so the overline sits ~1px above the radicand's own line box.
- Superscripts (lines 851-878) are rendered as `<sup>` with `verticalAlign: "super"` and `fontSize: 0.68em`. That raise pushes the glyph *above* its line box, so inside a radicand it overflows past the 1px headroom and touches or crosses the overline.

Result: the taller the radicand content (exponent, nested fraction with an exponent), the worse the overlap. The radical never grows to accommodate it.

## The fix

Make the radical size itself from what it actually contains, so the overline always clears the tallest raised content:

1. **Headroom is content-driven.** When building a radical, inspect the radicand source for raised content (`^{…}`, unicode superscript digits, nested `\frac` or `\sqrt` that themselves carry an exponent) and give the bar span extra top padding for that case instead of the flat `1px`. Deeper nesting gets proportionally more clearance, capped so simple roots stay compact.
2. **The hook grows with it.** The hook is `align-self: stretch`, so once the bar is taller the `√` stroke stretches to match automatically — the tick and the overline stay joined at the top-right corner, no gap and no floating bar.
3. **Exponents stay inside their box.** Replace the overflowing `verticalAlign: "super"` raise with a contained raise (`vertical-align: baseline` plus a relative offset on an inline-block), so a `<sup>` reports its real height to the layout. This is what lets any container — radical, bracket, fraction — reserve space for it rather than being crossed by it.
4. **Same rule in the editable surface.** `src/styles.css` `.math-struct--sqrt` / `--cuberoot` / `--nroot` use a `√` glyph at a fixed `1.28em` with `padding: 2px 5px 0` on the slot. Give those slots the same content-aware top padding and let the glyph stretch with the row height, so typing an exponent inside a root in the editor widens the root exactly as the rendered output does.

## Result

Any exponent inside a square root sits fully beneath the overline, with the radical automatically taller. `√((x − µ)²/N)` renders as a single clean expression. Nothing else about the math renderer, spacing rules, or the Smart Table changes.
