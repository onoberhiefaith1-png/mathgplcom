# Bring the table and text-size work into the new Game player

## What happened
Nothing was deleted. The accepted draft made every Game link open the new, lighter Game player. Your table and text-size work is still saved, but only in the original Game, which is now archived as Game Pro for admins. The new player never got those features, so they look like they disappeared.

## What will come back in the new player
1. **Tables on a writing surface**: a Game Line linked to a Smartboard table shows the whole table on one writing surface, just like in Lesson Notes. That means the same column widths and text size, headings on one line, Subcell working above a straight blue line with the answer below it, and every row's blue line moving down together.
2. **Surface ends at the table**: the table's writing surface stops where the table ends. You scroll to reach the other surfaces.
3. **Full-screen table**: a button that expands the table across the whole Game, uses the writing surface itself as the background, and keeps the text in readable matching ink. Pressing it again returns the table to normal size.
4. **Control row**: Advance, Sum Row, Sum Column and Table Size −/+ all appear as white text on blue. Table Size shows only in full screen, and Floating Numbers sit in the bottom dock.
5. **Coins, marks and Vaults on Subcells**: these work as before, with no green ticks on solved cells.
6. **Text size**: the scrollable text-size slider. It changes the size of the writing and keeps it inside the writing surface on phones too. I'll check this against the original Game and fill in anything that's missing.

## What stays the same
- Game Pro (the archived original) stays unchanged.
- The assignment-side controls stay exactly as they are.
- On phones, the # row comes first and Floating Numbers sit below it.
- Floating Numbers works the same way it does today.
- The new player still doesn't load any 3D.

## Technical details
- `ImaginePlayPage.tsx` already mounts `PresentationView`. It will get the same table wiring as `GamePlayPage.tsx`:
  - `tableSurfaceLines` mapping
  - `gameTableScales` and `gameTableHeights` state
  - `gameTable` slot payload using `gameTableNaturalSize` and `clampGameTableScale`
  - `gameTableConfig`, `gameTableScales` and `gameTableSurfaces` props
- `ImagineStage.tsx` will render a DOM mount point inside the anchor surface, as `SlateColumn.tsx` does, so the existing `TableActivityStage` can be moved into it. Hidden member lines will be skipped. The surface height will follow the measured table height.
- Focus background will come from the Imagine surface picture, or its colour as a fallback, and be passed through `gameTableSurfaces`.
- Text size: compare the Imagine `Type` control with the original slider (`scaleWritingTextSize` and `fitTextToWritingSurface`) and match them.
- Update the `AGENTS.md` Game rule so it notes that table surfaces are shared by both players.
- Run the existing `tableSurface` and `gameTableScale` tests and add one Imagine mapping test. Then do a signed-in visual check on desktop and phone.
