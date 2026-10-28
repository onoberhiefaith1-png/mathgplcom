# Full-width, resizable Game table surface

## Goal
Make every Game table fill the available writing-surface width by default, with compact minus and plus controls at the bottom for students to resize the table and its physical surface together.

## Changes
- Replace the current column-count-based table width estimate with a full-width Game table layout, while retaining the line-number strip and safe inner edges.
- Scale the existing interactive table as one unit so its text, cells, Subcells, coins, and toolbar grow or shrink together without clipping.
- Add familiar **−** and **+** icon controls along the bottom of table writing surfaces only.
- Make **+** enlarge both the table and its physical writing surface; make **−** reduce both together within safe minimum and maximum limits.
- Keep resizing local to the active table and preserve the same table state while moving between its tracks.
- Leave ordinary Game writing surfaces and the normal Smartboard table unchanged.

## Verification
- Add focused tests for the default full-width size and the minimum/maximum resize limits.
- Check the pictured phone-sized Game view: the table spans the writing surface, controls remain reachable, and no content overlaps the Game controller or Floating Numbers.
- Check a wider desktop view and confirm cell selection, Subcells, Calculate, Vaults, rewards, and table-track navigation still work.

## Technical details
The existing `TableActivityStage` remains the single table renderer. The Game surface mount will provide a shared scale value to both the table wrapper and physical-surface sizing calculation, avoiding a second table implementation.
