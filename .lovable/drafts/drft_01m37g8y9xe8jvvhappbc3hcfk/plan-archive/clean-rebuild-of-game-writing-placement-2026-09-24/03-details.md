## Rebuild steps

1. **Remove the conflicting horizontal placement system**
   - Delete per-line automatic horizontal guards, correction-to-indent writes and legacy X restoration from the render path.
   - Keep vertical placement and vertical containment separate; they must not influence horizontal start.
   - Normalise existing lines to zero indentation so old saved positions cannot return on line changes, reload or level changes.

2. **Create one scroll-level coordinate**
   - Calculate `contentMarginX` once from the fixed writing-band start and the saved margin value.
   - Do not add fold width, bevel, local surface padding, surface centre or measured text position to this coordinate.
   - Every surface consumes the same world X, while its decorative fold remains excluded from usable content.

3. **Use one-character breathing room**
   - Calculate a small gap from the rendered font's normal character advance, with a deterministic fallback before font measurement.
   - The hard left boundary is the margin; the first visible glyph is placed at `contentMarginX + characterGap`.
   - Effects such as bevel, glow and shadow are included, so no visible part of the first character crosses the margin.

4. **Rebuild rendering around a left-origin contract**
   - All Game lines render from a left-origin content box, regardless of the Text Settings alignment value previously saved.
   - Text Settings still control appearance. Alignment may arrange content only if it cannot change the shared starting boundary; it cannot create a second origin.
   - Structured mathematics, 3D text, plain fallback text, editable text and pointer/caret mapping use the same content frame.

5. **Straight guide and fixed surface start**
   - Render one continuous guide in scroll/world coordinates rather than one fold-adjusted segment per surface.
   - Keep the current top handle and drag behaviour.
   - Keep every surface's left edge fixed. Recalculate only usable width, wrapping, height and dynamic right edge after margin or text changes.

6. **Stop write-back loops**
   - Measurement reports size only; it cannot save a new horizontal position.
   - Margin movement produces one deterministic layout calculation, not measure → move → save → restore cycles.
   - Fix the currently reported `v is not defined` runtime error if its source appears during the rebuilt flow.

## Proof before completion

- Reproduce the uploaded case using `2(x + 3) − 4x = 8`.
- Verify Line 0 through Line 5 all begin exactly one character-space after one straight vertical line.
- Enter Line 1, then Line 2, then return to Line 1: no first character disappears and no line restores an old X-position.
- Drag the margin left and right on empty, short and long surfaces; all lines move together, wrap correctly and remain after it.
- Check normal text, structured mathematics, all text styles/effects, editable mode and plain loading fallback.
- Check Edit → Save → Reopen → Preview → Play → Test Play → switch level → resize → reload.
- Add regression tests proving identical start X for every line, zero legacy indentation after loading, no horizontal measurement write-back, straight guide coordinates, one-character clearance and stable repeated layout.
