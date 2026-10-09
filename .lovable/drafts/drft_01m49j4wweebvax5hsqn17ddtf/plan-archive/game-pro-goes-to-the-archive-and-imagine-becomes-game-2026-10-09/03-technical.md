## Technical details
- **New Game paths:** `/game`, `/game/play/:gameId`, `/game/slate/:gameId` render the Imagine pages (home, play, editor). `/imagine/*` redirects to the matching `/game/*`. Old link targets (class/student/Academia lists, quick action) stay the same.
- **Game Pro paths:** the 3D pages move to `/admin/game-pro`, `/admin/game-pro/play/:gameId`, `/admin/game-pro/slate/:gameId`, with an admin role check. `/adventure/games/*` redirects to `/game`.
- **Archive entry:** add a `game_pro` row to the `archived_features` list (archived = true). This is a small data insert into the shared backend, done with your OK when building. The admin Archive card shows an "Open Game Pro" link for it.
- **Wording:** "Imagine" changes to "Game" in page titles, buttons, tab titles and share text. Internal code folders keep their names, so the code doesn't churn.
- **Unchanged:** the 3D Game code, its data and its rewards are kept as they are. Only its address and who can see it change.
- Update the `AGENTS.md` rules about Imagine/Game and the matching memory note. Existing tests keep passing, plus a check that old Game links lead to the 2D Game.
