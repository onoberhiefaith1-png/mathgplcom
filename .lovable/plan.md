# Fix Square Root: Instant Visibility + Same-Row Alignment

## Problems observed
1. Clicking the square root on the floating number panel writes it to the board, but nothing appears until `b²` is clicked afterwards.
2. `b² − 4ac` (the radicand) floats several rows above `−b ±` instead of sitting on the same row, and the radical is oversized.

## Root causes
1. **Invisible empty sqrt** — in `MathTreeRender.tsx`, any container whose rows are all empty is treated as "structurally empty" and collapses to zero width when a sibling on the row already has content (the rule meant for leftover placeholder cubes). A freshly clicked sqrt has an empty radicand, so it collapses and is invisible until `b²` arrives.
2. **Baseline + stretch geometry** — `ConnectedRadical` stretches both children to the tallest content and anchors the whole box on the text baseline. When the radicand contains a superscript (`b²`), the box grows upward, lifting the radicand well above the `−b ±` row.

## Changes

### 1. `src/components/smartboard/MathTreeRender.tsx`
- Exempt `sqrt` (and other real math structures the teacher deliberately placed) from the empty-sibling collapse rule: an empty sqrt renders its hook + overline + dashed radicand placeholder immediately, so it appears the instant it is clicked.

### 2. `src/components/math/ConnectedRadical.tsx`
- Anchor the radical to the surrounding row instead of letting tall radicands push it upward:
  - Keep the radicand's own baseline aligned with the sibling text baseline (`−b`, `±`, `b² − 4ac` all on one row), letting the hook/overline extend upward only as much as the content needs.
  - Reduce overall scale slightly (~0.9em) and trim overline padding so the radical reads smaller and blends with the row.
- Since this primitive is shared, the fix applies to the Smartboard, Floating Numbers, and Lesson Notes at once.

### 3. Verification
- Run the existing test suite.
- Use Playwright against the live preview to render `x = (−b ± √(b² − 4ac)) / 2a`, screenshot it, and visually confirm:
  - `−b`, `±`, and `b² − 4ac` sit on the same row.
  - Clicking sqrt alone on the floating panel immediately shows the hook + placeholder on the board.
