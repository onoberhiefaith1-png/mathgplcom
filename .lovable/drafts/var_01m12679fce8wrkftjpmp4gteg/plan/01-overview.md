# Public Smart Card: name on the card, board on one click

A stranger who opens a shared Smart Card link should see the question, a small
"Playing as" name box, and one button that puts them straight on the Smart
Board. No account, no role picker, no second screen.

Three changes:

1. **Player name lives on the Smart Card page.** A small profile row under the
   question shows the automatic default name — `User 1`, `User 2`, … — with an
   Edit control so the player can type their own name before starting. The name
   is what the leaderboard shows, and it is remembered on that device.

2. **Start Challenge opens the board directly.** The name chosen on the card
   travels with the player, so neither the normal challenge nor the Game
   Challenge shows any further screen. The Game Challenge's "Choose a username"
   wall is removed, since the name is already set on the card.

3. **The board keeps its way back.** The top bar still shows the player name
   (editable there too) and "Back to Smart Card", so they solve and come out.

One important note about what you are seeing today: the shared public link
serves the **published** site. The gate you hit on the shared link is the older
published version — these changes only reach real visitors after this draft is
accepted into the project and the app is published again.
