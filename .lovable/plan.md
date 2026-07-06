## Diagnosis

The placeholder setting is currently reaching the Settings preview and some preview-style renderers, but the live whiteboard still has older placeholder behavior in the actual board render paths:

- The whiteboard math tree still has collapse/visibility rules mixed into placeholder rendering.
- The floating number display has its own chip/fraction rendering, so it can show the new color in one place but write old-style structures onto the board after a click.
- Present/preview note writes convert lesson-note math into Smartboard rows, but the final board renderer still decides how empty slots look, so the setting can be lost at the last step.
- There are multiple placeholder implementations: `MathTreeRender`, `mathRender`, `BoxLayer`, `StructurePanel`, and floating chip rendering. That is the blockage.

## Plan

1. **Create one fresh placeholder renderer**
   - Replace scattered placeholder box styling with one shared Smartboard placeholder primitive.
   - It will accept only `placeholderColor`, `active`, `caretColor`, and size.
   - It will not use `currentColor`, ink color, or inherited text color.

2. **Rewrite the whiteboard math-tree placeholder path**
   - Rebuild the empty-slot handling in `MathTreeRender`.
   - Fraction bars, radicals, brackets, digits, operators, and normal math stay ink-colored.
   - Every empty numerator/denominator/radicand/exponent/box slot uses only the placeholder color.
   - Remove old collapse/old-style dashed-box logic that can override the selected color.

3. **Force the floating number display to use the same placeholder style**
   - Replace floating display placeholder glyph rendering with the shared placeholder primitive.
   - For generated chips containing `□`, render real placeholder boxes, not black text squares.
   - For fraction chips, keep the fraction bar ink-colored, but placeholder parts use placeholder color.

4. **Force Present-click writes to land as clean board structures**
   - Keep present/preview writing through the existing write channel, but ensure converted `□` slots become real `box` nodes.
   - Make the board renderer, not the preview text renderer, responsible for the final live-board slot color.
   - This fixes the case where Present shows the right color, but clicking it produces old-style board slots.

5. **Rewrite manual fraction/box slots on the whiteboard**
   - Update `BoxLayer` so empty manual numerator/denominator boxes use the same shared placeholder primitive/color.
   - Filled boxes remain ink-colored text with transparent background.

6. **Keep settings/state propagation simple**
   - Keep `placeholderColorId` stored once.
   - Resolve `placeholderColor` once in `PresentationView` and pass it to every renderer: whiteboard, floating number display, structure panel, settings samples, lesson text, and sync snapshot.

7. **Verify the exact failure case**
   - Open the smartboard route.
   - Set placeholder color to a visible color.
   - Check Settings sample, floating number display, Present preview, and actual whiteboard after clicking Present/fraction.
   - Confirm: placeholders change color everywhere; fraction bars and normal ink do not change.
   - Set placeholder back to Board/whiteboard color and confirm slots blend into the whiteboard while bars remain ink-colored.