# Fix the stuck Game page and make Session Adventures playable

## What's wrong now

1. **Stuck on "This Game took too long to open".** The Back button tries to go to the previous page in history. When the Game was opened straight from a link there's no previous page, so nothing happens. This page also has no Quick Action button, so there's no other way out.
2. **"Not available for this account" when opening the Adventure.** The Session's Adventure card sends everyone to the *student-only* Adventure page. You're signed in as a teacher, so that page turns you away. Sharing has nothing to do with it: Adventures you shared with the school workspace can already be added and used there.
3. **The page an Adventure opens is the old one.** It shows a still picture with bar buttons, not the video that plays, pauses at each learning loop and continues.

## What I'll change

**A. Never stuck**
- On every Game error screen (too slow, not available, no question yet), Back goes to the page you came from. If there isn't one, it goes to the Session for an Academia activity, or to the Game list otherwise.
- Add **Try again**, which reloads the Game.
- Add the Quick Action button to these screens.

**B. Session Adventure plays the video, for teachers and students**
- Opening an Adventure from a Session plays its video with the Session's class. This works for students, teachers and school owners. A teacher who opens it gets a test run, so it isn't saved as a student's result.
- When the video reaches a learning loop, it keeps looping quietly in the background. The progress bar appears, and the first question on that bar opens on screen straight away, with no bar to click first.
- When a question is finished, the next question on that bar opens. Once the pass mark for that bar is reached, the questions close and the video carries on to the next loop.
- After the last bar, the Adventure is finished and you return to the Session.

**C. Pass mark**
- Every bar starts at **100%**.
- You can lower it in the Assign window, under Adventure, when you choose a progress bar. There's a Pass mark box, set to 100% by default.
- Bars that were saved with no pass mark count as 100%. Marks you have already set yourself stay as they are.

**D. Questions stay independent of lesson notes (no change)**
- Once a question is assigned, its copy is its own. Deleting or editing the lesson note doesn't change Games, Assignments, Adventures or Academia, and updates only happen when you choose to push them. I'll write this rule down so it stays that way.

## Not changing
- The Game itself (writing surfaces, scoring, rewards) stays locked. Only its error screen buttons change. Changing those buttons counts as a Game change, and approving this plan gives that permission.
- Your Adventures and their videos are never copied.

## Technical notes
- `ImaginePlayPage` error branches: fallback navigation (`academia` param → `/academia/activity/:id` session, else `/game`), retry via reload, and render `QuickActionBar`. Same treatment in `src/pages/game/GamePlayPage.tsx`.
- `AcademiaActivityPage.openAdventure` currently routes to `/student/class/:classId/game/:refId` (behind `RequireRole(["student"])`, old `StudentGameLivePage` canvas). Add a role-neutral route `/academia/adventure/$activityId` that resolves the class through `enterActivity`. It reuses the loop-runtime video player from `src/pages/student/GamePlayPage.tsx` (`loopRuntime`, `VideoBackgroundLayer`). The bar's `class_game_boards` questions are queued and opened automatically on loop entry, then advanced on completion. The video is released when the bar's `pass_pct ?? 100` is met. Teacher/owner sessions run in test mode.
- Adventure bar assign path (`barQuestions.ts` + `AssignDialog` Adventure tab): Pass mark input defaulting to 100; null `pass_pct` is read as 100.
- Record the question-independence rule in `AGENTS.md`. Record the Game-lock unlock for the error-screen controls in `mem://constraints/game-locked.md`.
- Verify headless: as a teacher (session minted), open the Session → Adventure. Confirm the video plays, the first question opens at the loop, and Back works from an error screen.
