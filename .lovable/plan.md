## Goal
Restore the previous clean math look by fixing the existing display path, not replacing the math engine.

## Confirmed current state
- The Smartboard display uses `renderMathInline` / `MathTreeRender`, while the AI Edit preview uses a tighter preview container and the same renderer in a different layout.
- The renderer currently positions superscripts with `position: relative; top: -0.55em`; this can misalign inside Smartboard handwriting rows.
- Smartboard row pitch is driven by `src/lib/smartboard/grid.ts`, with a default minimum row spacing of `1.28 × font size`.
- Lesson note document CSS still has `line-height: 28px` and paragraph `min-height: 28px`, which can add excess visual gap around generated equation lines.

## Plan
1. **Fix exponent structure in the shared renderer**
   - Update superscript/subscript rendering in `src/lib/notebook/mathRender.ts` to use the same compact baseline behavior as the working AI Edit look.
   - Remove the fragile vertical `top` offsets for normal scripts and use `vertical-align`/small line-height so powers like `x^2`, `x^3`, and nested powers remain naturally attached to the base.

2. **Tighten stacked math only where needed**
   - Keep fractions/radicals readable, but reduce unnecessary vertical translation and leading that can make equation rows appear too tall.
   - Avoid changing parsing, AI generation, or solution insertion logic.

3. **Reduce equation gaps in notebook display CSS**
   - Adjust `.lesson-doc` paragraph rhythm in `src/index.css` so generated equation lines sit closer together.
   - Add targeted CSS for math display elements so math containers do not inherit oversized prose leading.

4. **Tighten Smartboard default row spacing**
   - Reduce the default natural row pitch in `src/lib/smartboard/grid.ts` slightly so consecutive equations are closer by default.
   - Preserve the existing Row Spacing control so teachers can still increase the gap manually.

5. **Verify the fix**
   - Run focused tests/type checks only if needed by the changed files.
   - Use the live preview to compare a sample line like `= 3x^2 cos x - x^3 sin x` and confirm the exponent is raised cleanly and the equation gap is reduced.