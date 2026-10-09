# Focused Game table: writing-surface background and controls

## Goal
Refine the expanded table view so it feels like enlarging the Game’s selected writing surface, not opening a separate dark screen.

## Changes

### 1. Make the writing surface fill the expanded view
- Use the table line’s own selected writing surface as the complete expanded background.
- Carry over that surface’s material/texture, colour, border treatment, and matching ink colour.
- Hide the Game room/background while the table is expanded; the enlarged writing surface becomes the whole visible workspace.
- Preserve sufficient contrast for headings, table text, grid lines, selected cells, progress, and controls on light and dark surfaces.

### 2. Keep the table readable and spacious
- Keep the full interactive table in the upper working area with the Lesson Note dimensions and proportions.
- Let the table area scroll when needed without hiding the actions or Floating Numbers.
- Preserve Subcells, working/answer separators, coins, Vaults, immediate evaluation, and the current selected cell.

### 3. Move Table Size into the table action row
- Remove the standalone “Table size − +” dock from the bottom.
- Add “Table Size”, minus, and plus directly after Advance in the row containing Sum Row, Sum Column, and Advance.
- Show these resize controls only in the expanded table view, as before.
- Keep the action row readable and horizontally scrollable on narrow screens rather than clipping controls.

### 4. Put Floating Numbers in the bottom dock
- Dock the existing live Floating Numbers panel in the bottom position vacated by Table Size.
- Keep it above phone browser controls and always reachable while the table content scrolls.
- Reuse the existing Floating Numbers instance and insertion path so taps continue writing into the active table cell/Subcell without changing mathematics, timing, or grading.
- Keep the expand/collapse button visible; collapsing restores the same Game position and table state.

## Validation
- Verify a dark selected surface and a light selected surface both retain their correct background and readable matching ink.
- Verify action order: Sum Row, Sum Column, Advance, Table Size −/+ (with Calculate still appearing when applicable).
- Verify Floating Numbers occupies the bottom dock, inserts into the selected cell, and remains above the phone browser bar.
- Verify resize, table scrolling, expand/collapse, Escape, Vaults, rewards, progress, and immediate grading.
- Check desktop and phone layouts for clipping or overlap.

## Technical details
- Pass the active table surface identity and optional Plain-surface colour from the Game into Presentation View.
- Build the focused layer from the existing surface registry rather than inventing a new colour theme.
- Add a focused-mode slot to the shared table toolbar for resize controls.
- Give Floating Numbers an explicit focused-table portal target while expanded, returning it to its existing Game mount on collapse.
