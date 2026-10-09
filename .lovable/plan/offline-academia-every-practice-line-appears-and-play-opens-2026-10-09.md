# Offline Academia: every Practice line appears, and Play opens the real Game

## What is wrong now
1. **Practice is missing Line 1.** The offline pack builder always treats the first saved solution line as the question (Line 0) and hides it. When an activity's saved lines start at the first working step instead of the question, the real Line 1 gets used as the question and disappears from the board.
2. **Play opens Practice.** The offline activity screen always opens the Smartboard, whichever button was tapped. Play has no path into the Game yet.

## Fix 1: all lines in Practice
- Build the offline question the same way the connected Practice board does. The question comes from the activity's own question text (the question block above the solution). Every saved solution line then becomes a writable line, starting at Line 1.
- Only use the first saved line as the question when it is the question restated word for word (the existing "Line 0 restates the question" rule). Otherwise, keep it as Line 1.
- Marks, timers, notes, Vaults and video line mapping keep pointing to the right lines after this change.
- Add tests for both cases: with the question restated, and without it. Neither case may drop a line.

## Fix 2: Play opens the Game offline
- When Play is tapped, the offline activity screen opens the real Game player in offline mode, using the downloaded Game (teacher's background, music, surfaces, items, lives, Energy Ball/Vault rewards, table surfaces). This player and its offline mode already exist.
- Play uses the same corrected question board, so all lines appear on their own writing surfaces.
- Marking stays on the phone with no AI. Play attempts save and sync later, the same way Practice attempts do.
- The Play video (if attached) follows the lines, as it does in Practice.
- Exit Game and Back return to the Session.
- If an activity has no Game attached, the Play button stays hidden, as it does online.
- Teacher assets are fetched only through the existing safe media address, then saved on the phone.

## Checks before reporting back
- Automated tests for the line rule and for Play choosing the Game.
- In a simulated phone browser: download the pack, go offline, and open Practice (all lines present, including Line 1). Then open Play (the Game appears, not the Smartboard). Mark one line in each.
- After the update, you'll need to tap Update Pack on your phone once, because the pack format changes.

## Technical details
- `src/lib/offline/academiaPack.ts` `compileOfflineBoard`: accept an explicit `questionText`, which comes from the subsection's question block or `activity.question_key` content, using the same source as the connected `assessmentBoardSource`. Drop `lines[0]` only when it matches that question (equationsMatch). Bump `ACADEMIA_PACK_SCHEMA` to 3.
- `src/routes/api/public/academia-pack.ts`: select and pass the question text. Step one is confirming which field the connected Practice board uses for Line 0.
- `src/pages/academiaApp/OfflineActivity.tsx`: when `mode === "play"` and `bundle.game` is present, render `ImaginePlayPage` with `offline={{ activityId, game, board, startingLives, assetUrls, playVideo, onExit: onBack }}` and record the attempt through `onFinish`. Practice keeps `PresentationView`.
- `AcademiaApp.tsx`: show Play only when `activity.game` is present.
