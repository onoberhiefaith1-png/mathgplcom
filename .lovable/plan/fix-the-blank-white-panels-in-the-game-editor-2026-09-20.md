# Fix the blank white panels in the Game editor

## What you are seeing

The cream/white slabs with a small dot on the left are not a writing surface at all. They are the board's emergency backup drawing — a plain placeholder the board falls back to while its artwork is still loading. It has no writing area, no numbers, no rewards and no click targets, which is exactly why you cannot click it, write on it, or move it up and down.

In a clean test session the same game draws the real Magical Aura panels with numbers and reward pieces, so your saved design is intact. The board is getting stuck on the placeholder instead of finishing the swap to the real surfaces.

## What will be done

1. Find what the board is waiting on
   - Instrument the artwork loading path (surface material maps, reward pieces, opened-vault pieces) and identify which item never finishes in the stuck session.
   - Treat the reported "v is not defined" error in the same pass, since it may be what stops the swap.

2. Make the placeholder impossible to get stuck on
   - Give the artwork loading a bounded wait. If a piece has not arrived, the real writing surfaces still appear (usable, clickable, writable) and the artwork fills in when it lands.
   - If a piece genuinely fails, keep the surface working and skip only that decoration instead of replacing the whole board.
   - The placeholder stays purely as the first-frame paint, never a resting state, and it announces itself while visible so a stuck board is never mistaken for a design.

3. Restore full editing on the panels
   - Clicking a panel selects it and puts the cursor on its writing line.
   - Typing lands in full (a dropped-characters problem was reproduced in testing: only the first character arrived).
   - Wheel and drag move the board up and down, and the surface grows with content as it already does in Play.

4. No design changes
   - Surface artwork, sizes, numbers, rewards, spacing, background and Play behaviour stay exactly as saved. Nothing about the look or the reward system is redesigned.

## Verification

- Open your game in Edit: real Magical Aura surfaces appear, no cream placeholder.
- Click surfaces 1, 2 and 3, type a full expression on each, confirm every character appears.
- Scroll and drag the board through surfaces 1 to 7.
- Switch to Play and confirm line activation and rewards behave as they do now.
- Reload twice with a large saved background to confirm the placeholder never sticks.

## Technical notes

- The placeholder is `SurfaceFallback`, shown by `WorldStage` as the `Suspense` fallback around `SlateColumn`. Colour `#f4ead7`, left dot `#6f624d`, rule on the first region — an exact match for the slabs in the screenshot.
- Suspension sources inside `SlateColumn`: `useTexture(artDefs.map(r => r.art))`, `useTexture(openDefs.map(r => r.openArt))`, and `usePbr(...)` in `world/pbr.ts`. All PBR and reward pointers resolve in the repo, so the stall is runtime (network/decode/cache), not a missing file.
- Fix direction: load artwork outside the render-blocking suspense path (resolve to textures in state, render surfaces immediately, attach maps when ready) so a slow or failed texture can never withhold the interactive surfaces.
- Typing loss is in the Edit hidden-input path (`WritingRegion` / board keyboard handling), investigated separately from the fallback fix.
