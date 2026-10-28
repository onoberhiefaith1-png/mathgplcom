# Guest Link for Class Games

Add a **Guest link** button to each Game card on the class Games page (next to Play / Game Board / Unassign), working the same way as the Assignment and Course guest links.

## What the teacher sees
- A "Guest link" button on every Game card.
- It opens the same share window used for Assignments: copy link, switch the link on/off, "ask for name" toggle, Live guests and Guest Performance.
- One link per Game card per class, reused forever.

## What the guest sees
- Opening the link (`mathgpl.com/g-game/<code>` style short address) needs no sign-in, no registration, no class joining.
- They get every Level enclosed in that Game card for that class, in order, and play it on their own device in the same Game Play view students use (writing surfaces, Floating Numbers, timers, lives, rewards, sounds).
- Marks are instant and saved only under Guest Performance, never into the class roster or student progress.
- Progress stays on their device across refreshes (same guest token as other guest links).

## Technical details
- `guest_links.kind` gains `"game"` (resource_id = game id, class_id = class). Code prefix `G`; URL `/gm/<code>`.
- `ClassGamesPage.tsx`: add Guest link button that opens `GuestLinkDialog` with `kind="game"`; the dialog's `onReady` runs `ensureGameBoards` so Levels are compiled before sharing.
- Public endpoint `/api/public/guest/$slug`: new `game` branch returns the saved game world plus the class's compiled Level boards (read with the server privileged client only after the link is found and enabled). Answer keys are never sent; marking goes through a new `action=grade` POST that checks the line server-side and writes `guest_attempts` / `guest_presence`.
- New public route `src/routes/gm.$code.tsx` rendering `GuestGate` → a guest mode of Game Play. `GamePlayPage` gets a data-source seam (signed-in loaders vs guest payload + guest grader) so the runtime itself is untouched.
- Game results for guests are written via the guest endpoint instead of `saveGameResult`.
- No change to reward-conversion maths, marking rules, Line 0 / Line 1 behaviour.

## Out of scope
- Guest leaderboards against students, and guests joining live teacher-run sessions.
