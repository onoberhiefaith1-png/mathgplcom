# Game Challenge: put the Smart Card in the middle

Right now the Game Challenge jumps from the setup screen ("Link Question to Progress Bar") straight to the Adventure stage — the shared/opened link goes directly to the game. The public Smart Card page already knows how to render a Game Challenge (it shows "Enter Game Challenge" instead of "Start Challenge"), but nothing routes through it.

## Target order

```text
1. Link Question to Progress Bar   (teacher setup, exists)
2. Smart Card page  /c/:slug       (public card + stats + Start Challenge)  ← missing step
3. Game stage       /c/:slug/game  (Adventure canvas + progress bars, exists)
4. Student Smartboard              (opened from a progress bar, exists)
```

## Changes

1. **Game Challenge dashboard** (`src/pages/live/SmartCardGameDashboardPage.tsx`)
   - "Open player view" now opens `/c/:slug` (the Smart Card), not `/c/:slug/game`.
   - Add the public link text/copy affordance so the teacher shares the card URL, matching the normal Challenge flow.

2. **Publish step** (`src/pages/live/SmartCardGameSetupPage.tsx`)
   - After "Publish Game Challenge", keep landing on the dashboard, but surface the card link (`/c/:slug`) as the thing to share.

3. **Smart Card page in game mode** (`src/pages/public/SmartCardPage.tsx`)
   - Keep the exact same card layout as the normal Challenge (question, emojis, diagram, stats row, Share Mode).
   - Button label stays "Enter Game Challenge"; pressing it signs the visitor in if needed and then opens `/c/:slug/game` (already implemented, verified end-to-end).

4. **Game stage back-navigation** (`src/pages/public/SmartCardGamePage.tsx`)
   - The Back arrow returns to `/c/:slug` (the Smart Card) instead of exiting the flow, so the three screens form one chain.

No database or edge-function changes: `publish_mode = "game"` is already returned by the public card payload and drives the card's button.
