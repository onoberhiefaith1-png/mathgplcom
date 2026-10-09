# Neaten the Game table and align every Calculation Subcell

## Result
- Keep each heading on one line, including `(x − μ)²`, by preserving the authored column proportions and giving math headings enough minimum width instead of wrapping them.
- Keep each Subcell expression on one line, including `12 − 15` and `(−3)²`, without splitting a base from its superscript.
- Remove the green completed tick. A locked coin remains visible until earned, then disappears; marks and reward logic continue unchanged.
- Align every blue Subcell divider across its whole row. If one expression grows taller because the student adds another working line, every divider in that row moves down together and the row expands cleanly.
- Keep the answer area aligned beneath the shared divider, with no overlap or clipped mathematics.

## Implementation
- Update the shared `TableActivityStage` used by Smartboard and Game, so the improvement applies to the same live table rather than creating a Game-only copy.
- Add row-level Subcell measurement: observe each working area, take the tallest working area in that row, and apply that shared height to every Subcell working area in the row. Recalculate after typing, resizing, scaling, Advance changes, and focus-mode changes.
- Use no-wrap math containers for headers and one-line calculations, while allowing an explicitly added second working line to increase the shared row height.
- Change the Game reward badge renderer so solved Subcells render no badge, while unsolved coin/Vault states remain intact.
- Preserve the existing table background, ink, Floating Numbers, Calculate, Advance, scoring, Vaults, and table-focus behavior.

## Verification
- Check the supplied statistics table in normal and expanded Game views: headings and single-line calculations remain straight, all blue dividers align per row, and multiline work moves the complete row divider down.
- Confirm the green ticks are gone, coins still disappear only after activation, rewards still award once, and answers remain beneath the divider.
- Run the focused table and reward tests, type checking, and preview build check; verify desktop and phone layouts.
