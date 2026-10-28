# Academia Adventure: shuffle fix + finishing pass from your document

Scope: only the Academia Adventure (video + Game). The standalone Adventure, its Smartboard, normal Game levels, Question Cards and lesson notes stay as they are. The one shared fix is the early-completion bug, which is corrected at its root.

## What I already confirmed
- **Shuffle:** you did shuffle. All four "one unknown" questions you assigned at 09:00-09:02 today were saved with your shuffled order on every line. The Academia Adventure turns each question into a Game board using the same builder as the offline Mathemagine app, and that builder ignores the saved shuffle. The Smartboard and normal Game already use it.
- **Silent video:** this Adventure's video is saved with its sound switched off, and the Academia player plays it exactly as saved. The standalone Adventure is the one that turns sound on after you press Play.
- **Game "disappearing":** your chosen Game is saved for this Session's Adventure. The Game button only looks up the Game's name after you open the picker, so when you come back it doesn't clearly show which Game is chosen.
- **Progress and time bars:** they are thin 10-pixel strips at the screen edges, not the Adventure's own progress bar design, which is why you could hardly see them.
- **Loading between questions:** after each question the Game is told to move on, then reloads the next board, which causes the short spinner.

Not yet confirmed: why a question finishes at the second-to-last line. Finding that is the first step of item 6.

## What gets built
1. **Shuffle:** the Adventure and offline app show chips in your saved shuffled order. Marking is unchanged. Questions you already assigned pick this up without reassigning.
2. **Sound back on:** the Adventure video plays with sound after the student presses Play (browsers need that tap). The saved video setting stays untouched.
3. **Game stays chosen:** the button shows the chosen Game's name as soon as the page opens, with a "Change Game" option. Changing it replaces the one saved Game; the old Game stays in your library.
4. **Audio settings (three-dot menu on the Adventure card):**
   - "Background music during narration" (0-100%, default 10%) and "Narrator volume" (0-100%, default 70%).
   - Narration times: you mark where the narrator starts and stops on the video (add/remove segments), with a Preview button to hear the mix.
   - Saved for this Session's Adventure only. The Game's and standalone Adventure's own sound settings don't change.
5. **One continuous music track:** the chosen Game's background music starts with the Adventure and keeps playing through questions, loops and learning points without restarting. It fades down to your level over about 5 seconds before each narration segment and fades back up afterwards. Students get one master volume slider that turns the whole mix up or down. Reward sounds stay separate.
   - Limitation: if the video's own music and narration are in the same soundtrack, they can't be separated. The video's sound is treated as narration, and the Game music is ducked under it.
6. **Question only completes on its final line:** find the real cause of the early full marks and fix it so a question counts as complete, with full marks, only after its last required line is checked. Partial marks still count.
7. **Pass mark is for the whole learning point:** marks add up across that point's questions (for example 10 + 20 + 20 + 20 = 70 passes a 70% point). An unfinished question stays recorded as unfinished. Default stays 100%, and your saved value is never reset.
8. **Visible progress bar:** use the Adventure's own progress bar design, filled from this learning point's marks only (20 of 100 shows 20%), with the pass-mark line on it.
9. **One clock:** the time bar reads the Game's own timer, so hourglass and spark time bonuses move both together. Fills from bottom to top.
10. **Move freely between questions:** students can go up and down between all questions in the current learning point, skip and come back with their working kept. Finished questions slide up and the next comes in from below. They can't leave the learning point until its pass mark is reached.
11. **No loading between questions:** everything for the Adventure is prepared before play starts. Moving between questions switches the question inside the same Game, so the music, timer and video don't restart and no spinner appears.

## Checks
- Small tests for: shuffled chip order; question complete only after its final line; adding up marks for the learning point (70% example, and 100% blocks); default 100% and saved value kept; music level at each point of a fade; master volume scaling the whole mix.
- Signed-in run of this Session's Adventure on desktop and phone size: sound, Game stays chosen after refresh, bars move, no spinner, video continues after passing.

## Technical details
- Shuffle: `compileOfflineBoard` (`src/lib/offline/academiaPack.ts`) maps `line.fillers` through `line.arrangement` when lengths match (same rule as `presentation.ts`).
- Audio: `VideoBackgroundLayer` takes a `forceAudible`/gain prop only from `AcademiaAdventurePlayer`. A new pure `src/lib/academia/adventureMix.ts` handles duck curves and master gain, and one Web Audio mixer lives for the whole attempt. New nullable `audio` jsonb on `academia_activities` holds levels and narration segments (migration with owner/builder RLS that matches the existing activity policies).
- Game picker: `AdventureGameButton` resolves the name from `gameId` on mount.
- Completion: trace `runtime.completion` / the line-count path in the shared Game runtime and fix the off-by-one or threshold cause. The embedded flow stops calling `continueCompletion` blindly and switches boards through a runtime "go to question" call. Game lock: this touches Game files and needs your unlock for items 6, 10 and 11 (recorded in the Game lock notes).
- Bars: reuse the existing Adventure progress-bar component. The time bar is driven from `runtime.questionDeadline` plus bonuses.
- Preload: boards are compiled once per point and assets warmed before the first loop. The `ImaginePlayPage` key no longer changes per question.
