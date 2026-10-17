# Game table: expand in place instead of a separate full screen

## What changes for students
Today, the expand button on a Game table opens it as a separate full-screen page that covers the question. After this change, the same button makes the **table's own writing surface** turn into that full-size view, right where the table sits in the Game:

- The question surface stays above it. Students scroll the Game up to read the numbers, then scroll back down to the table.
- The expanded table is tall (about the height of the screen) and scrolls on its own, up and down and sideways, just like the full screen does now.
- The table tools (eraser, #, undo/redo, T1.1 arrows), Table Size − / + and the Floating Numbers sit at the bottom of that same surface, as in your first screenshot.
- Below the table, the surfaces underneath (the text lines after it) are still there. Students reach them by scrolling the Game down.
- Pressing the button again shrinks the table back to its compact size. What students wrote, coins, Vaults and marks don't change.

Everything stays on one page, so there's no jumping between screens.

## What stays the same
- How students write in cells, coins, Vaults, marking, rewards, timers, lives and line order.
- The compact table size, and each table's saved Table Size.
- The Smartboard and lesson-note tables.
- Game Pro uses the same table, so it gets the same in-place expand.

## Game lock
The Game is locked. This request counts as your approval for this change only: how the table surface expands, and where its tools and Floating Numbers appear. I'll add that to the lock notes. Nothing else in the Game changes.

## Technical details
- `PresentationView.tsx` game table block: stop portalling to `document.body` while focused. Always render into `gameTableMount`. The focused state switches classes from `fixed inset-0 z-[10020]` to an in-flow panel (`h-[min(88dvh,…)]`, `overflow-hidden`, internal `overflow-auto` scroller), keeping the surface texture styling.
- When focused, report the expanded height via `onGameTableHeightChange` so `ImaginePlayPage` (and the Game Pro player) grow that one surface in the layout. Restore the measured compact height on collapse. The compact-height measurement is unchanged.
- The floating dock (`setFocusedTableDock`) stays inside the surface as a sticky bottom strip, so Floating Numbers render inline, not over the page.
- After expanding, scroll the table surface into view (`scrollIntoView({block:"start"})`), so the question stays reachable by scrolling up.
- Add the scope to `.lovable/memory/constraints/game-locked.md` and to the Game lock check's approved list for the touched files.
- Test: expanding keeps entries/solved coins, and the surface's reported height grows and then returns to the compact value. Browser check at phone size (428×679): question visible on scroll-up, lines below on scroll-down.
