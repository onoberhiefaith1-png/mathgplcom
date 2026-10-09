# Full interactive table on one Game writing surface

## What changes
1. **One table, one physical surface**
   - Keep all Floating Numbers lines belonging to the same table collapsed into one Game Line.
   - Remove the temporary `▦ Table` / row-equation text from that surface.
   - Show the complete saved table grid there instead: headings, rows, columns, Subcells, blue dividers and existing values.

2. **Place the real table inside the surface**
   - Give the table Game Line a dedicated surface mount tied to that exact physical writing surface.
   - Portal the existing `TableActivityStage` into that mount, rather than drawing a separate fixed panel over the Game.
   - Size the surface from the table dimensions and keep the full grid inside its edges on desktop, tablet and phone; wide tables scroll within the surface instead of becoming flattened text.

3. **Keep the existing table interaction**
   - Clicking a normal cell or Subcell selects its existing Floating Numbers track.
   - Typing, Calculate, marks, coins, Vaults and immediate evaluation continue through the current Smartboard table engine.
   - Moving between table tracks keeps the same full table visible on the same surface; it never creates another surface per row or column.

4. **Preserve all non-table Game Lines**
   - Questions and ordinary equation lines continue using the existing 3D writing-surface text renderer.
   - Normal Game Levels, Academia single-question launches, shared links and assigned Games keep their current navigation and scoring.

## Verification
- Add regression coverage proving one table object produces one visible surface and no flattened placeholder/equation text.
- Open the pictured Game and confirm Line 10 contains the full interactive table inside the parchment surface.
- Select several rows, normal cells and Subcells; confirm the surface stays fixed while Floating Numbers, Calculate and rewards follow the selection.
- Check desktop and phone sizing, then confirm ordinary non-table Game lines are unchanged.

## Technical details
- `GamePlayPage.tsx`: mark the anchor slot as a table surface instead of assigning placeholder text; continue hiding sibling table lines.
- Game world surface rendering: expose a stable DOM mount positioned within the table anchor’s physical surface and report its usable bounds.
- `PresentationView.tsx`: portal the existing Game `TableActivityStage` into that mount; remove the fixed top-of-screen table panel.
- Keep table identity and behavior sourced from `buildTableGroups(...)` and `src/lib/slate/tableSurface.ts`; do not create a second table renderer or re-derive the grid from equation text.
