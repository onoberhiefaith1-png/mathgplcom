# Game table — match the Lesson Note exactly

## Goal
Replace the current stretched Game-table presentation with the same clear table composition shown in the marked Lesson Note: matching cell proportions, spacing, borders, mathematics size, and Subcell working/answer layout. The complete table remains one interactive Game writing surface.

## What will change
1. **Use the Lesson Note table measurements in the Game**
   - Preserve the table’s original column widths instead of forcing equal-width cells across a stretched grid.
   - Carry the saved Lesson Note text size, cell padding, borders, alignment, and header treatment into the Game table.
   - Keep each calculation’s working above the blue divider and its answer below, with the same visual proportions as the Lesson Note.

2. **Make the writing surface fit the table**
   - Size the table Game surface from the table’s real rendered width and height, including headers, all rows, Subcells, and controls.
   - Let this table surface become large enough to dominate the view; other Game surfaces may move above or below and remain reachable by scrolling.
   - Remove the current extra scaling/stretch behavior that makes the Game version look unlike the Lesson Note.
   - Keep the existing minus/plus controls, but make them resize the complete table and its physical writing surface together without distorting cell proportions.

3. **Improve readability below the table**
   - Make **Advance**, **Sum Row**, **Sum Column**, **Calculate**, and related table actions larger, bold, high-contrast, and easy to read.
   - Keep these actions directly associated with the table without covering its cells.

4. **Preserve all table behavior**
   - Keep one table only, using the existing shared Smartboard table interaction.
   - Preserve cell editing, Subcells, Floating Numbers, Calculate, Vaults, marks, coins, progress, and instant evaluation.
   - Leave ordinary Game writing surfaces and Lesson Note editing behavior unchanged.

5. **Verify while signed in**
   - Open the affected Game with the available signed-in account.
   - Check the table visually against the marked Lesson Note on desktop and phone sizes.
   - Confirm the complete table is readable, cell dimensions stay proportional, controls are legible, scrolling reaches surrounding surfaces, and minus/plus resizing works.
   - Run the focused table-surface tests and confirm the preview has no build or runtime errors.

## Confirmed current state
- The Game already mounts the shared `TableActivityStage`, so this will refine the one authoritative table rather than introduce a second renderer.
- The Game currently forces a full-width fixed table and applies a separate scale transform; the Lesson Note instead uses its saved column widths, padding, borders, and text size.
- The current table actions use very small 11px text with normal emphasis, which explains the readability problem in the Game.

## Technical notes
- Extend the table payload used by the Game surface with the saved visual measurements required by the shared renderer.
- Add a Lesson Note fidelity display mode to the shared table stage rather than copying table markup.
- Measure the rendered table container and feed that size into the physical Game surface layout, with bounded resize controls and stable scroll anchoring.
- Add focused tests for preserved proportions, bounded resizing, and surface sizing from table dimensions.
