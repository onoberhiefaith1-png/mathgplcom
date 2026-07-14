## Goal
Make invisible cells in **Division Ladder** and **Base Conversion** reveal themselves as the pointer ("sensor") moves over them, so teachers can see where they will insert a number. The outline disappears when the pointer leaves.

## Behavior
- As the pointer moves over a cell, that cell shows a faint **vertical guide** (left + right thin borders) plus a subtle background tint.
- Only **one cell** highlights at a time (the one directly under the pointer).
- On pointer leave (or when the pointer moves outside the table), the guide disappears.
- No click required. No change to focus, typing, or existing behavior.
- The permanent divider line (left vertical rule) stays exactly as it is.
- Toolbar hover-idle behavior is untouched.

## Files to change
1. `src/components/lessonnotes/extensions/visuals/arithmetic/DivisionLadder.tsx`
2. `src/components/lessonnotes/extensions/visuals/arithmetic/BaseConversion.tsx`

## Technical details
- Add local state `hover: { r: number; c: number } | null` in each component.
- On each `<td>` add `onPointerEnter={() => setHover({r,c})}` and on the `<table>` add `onPointerLeave={() => setHover(null)}`.
- When `hover.r === r && hover.c === c`, apply an inline style overlay:
  - `borderLeft: "1px dashed rgba(15,23,42,0.35)"`
  - `borderRight: "1px dashed rgba(15,23,42,0.35)"`
  - `background: "rgba(15,23,42,0.04)"`
- Use `box-sizing: border-box` (or negative margin) so adding a 1px border doesn't shift column width.
- Do NOT override the existing `borderRight` on the divider column — keep that cell's solid divider intact and only add the top/bottom hover tint there.
- Skip highlighting on cells that are intentionally empty (e.g. the result-row divisor cell in DivisionLadder) — pointer enter still sets hover, but the cell already renders no input so it's harmless; keep it consistent.

## Out of scope
- LongDivision (already has its own layout).
- No changes to Properties Panel, toolbar, keyboard nav, or data model.
- No column-wide or row-wide highlighting — only the single cell under the pointer.