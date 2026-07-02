## Goal

Make the square root a **single connected shape** that expands vertically and horizontally with its radicand — identical geometry in all three surfaces (Lesson Note editor, Floating Number panel, Smartboard). No more literal `√` glyph next to a separate overline. No more short/broken hook. Clicking a `√` chip on the Smartboard must place a real, connected, expandable radical on the board.

## What's wrong today

All three renderers currently build the radical as **two disconnected pieces**:
- a literal Unicode `√` character (fixed font size, cannot grow), and
- a separate `<span>` with `border-top` for the overline.

Because the two live in a `baseline`-aligned flexbox, the tip of the `√` and the left end of the overline don't meet, and the hook height never changes when the radicand grows tall (e.g. a fraction inside). On the Smartboard the hook does use an SVG, but the overline still starts as a separate span so it appears detached and a click that inserts a bare `sqrt` node with an empty radicand shows almost nothing.

## Fix — shared `ConnectedRadical` primitive

Introduce one visual primitive used by all three surfaces so the geometry is guaranteed to match.

```text
 ┌─── overline (border-top on wrapper) ───┐
 │                                        │
 │  radicand content (grows freely)       │
 ╲                                        │
  ╲__ hook (SVG, stretched to wrapper) ───┘
```

Structure:
- Outer `inline-flex` with `alignItems: stretch` (not center/baseline).
- Left child: SVG hook, `preserveAspectRatio="none"`, `height:100%`, path drawn so that its top-right point is exactly at the SVG's top-right corner.
- Right child: a wrapper span with `borderTop: 1.4px solid currentColor`, `flex: 1`, padding for the radicand. Wrapper starts flush at the SVG's top-right so hook tip and overline meet pixel-perfect at every zoom level.
- Optional degree index rendered as a small superscript in the top-left, absolutely or via negative-margin flex, sized `0.55em`.
- Because the wrapper stretches to the tallest child (the radicand), the SVG hook stretches to match — automatic vertical expansion for fractions, nested radicals, etc.

## Places to update

1. **`src/components/smartboard/MathTreeRender.tsx` — `SqrtView`**
   - Replace the current `alignItems: center` layout with the stretch layout above.
   - Ensure the SVG path terminates at `(viewBoxWidth, 0)` and the overline span starts at `marginLeft: 0` so they touch.
   - Render a visible **empty radicand placeholder** (the existing `EmptyDot`/slot glyph used by other empty sub-rows) when `node.rows[0]` is empty, so a freshly inserted `√` is visible on the Smartboard.

2. **`src/components/floating/EquationAtoms.tsx` — `sqrt` branch**
   - Remove the `Leaf` that prints the Unicode `√` glyph.
   - Wrap the hook in the same shared `ConnectedRadical` primitive; keep the sign atom's id on the SVG wrapper so click/hover/selection (`selected.has(n.sign.id)`, `ringFor`, `toggle`) still highlight the whole radical.
   - Degree renders via the same superscript slot.

3. **`src/lib/notebook/mathRender.ts` — `\sqrt{…}`, `\sqrt[n]{…}`, and the unbalanced fallback**
   - Replace the three near-duplicate blocks that emit `<span>√</span><span borderTop>…</span>` with a single helper that emits the connected primitive (SVG hook + stretched overline).
   - Keep the existing `data-math-kind="radical"` / `data-math-src` attributes so downstream selection code keeps working.
   - Also render an empty-slot marker for the unbalanced case so nothing appears "missing".

4. **Shared primitive location**
   - Add `src/components/math/ConnectedRadical.tsx` exporting a small React component `ConnectedRadical({ degree, children })`. Both `MathTreeRender.SqrtView` and `EquationAtoms` import it. `mathRender.ts` (which builds via `createElement`) uses a sibling helper `renderConnectedRadicalMarkup(children, degree?)` that returns the same DOM shape without JSX.
   - Single source of truth prevents the three surfaces from drifting apart again.

5. **Smartboard sqrt click path**
   - Verify `insertNode(mkSqrt())` descends into `rows[0]` (already true in `mathTree.ts.firstEmptySub`). With the new placeholder dot in `SqrtView` the freshly inserted radical is visibly present on the board even before any character is typed, fixing the "nothing showed" report.

## Tests

- Extend `src/test/floatingHighlightEngine.test.ts` (or add `src/test/connectedRadical.test.ts`) to snapshot the DOM of `√(x+1)`, `√(a/b)`, and `∛(x)` from all three renderers and assert the outer wrapper is a single element with one `border-top` child and one SVG child (no literal `√` text node).
- Add a Smartboard test that inserts `mkSqrt()` on an empty row and asserts the rendered node is non-empty (contains the SVG and the border-top wrapper).

## Out of scope

- No changes to the mirror/parser (`mirrorFromLessonNote.ts` already produces `sqrt` nodes correctly).
- No changes to how radicals are stored (`\sqrt{...}` in Lesson Notes; `sqrt` node in the tree).
- No visual changes to fractions, brackets, or other structures.
