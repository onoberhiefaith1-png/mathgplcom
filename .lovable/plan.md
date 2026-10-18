# Keep the teacher's shuffle in Academia Adventure and the offline app

## What was found
- You did shuffle. The four "one unknown" questions you assigned this morning (09:00–09:02) were all saved with your shuffled order on every line (for example the first line saved as 2, 4, 1, 3).
- The shuffle is lost when the question is turned into the Game board. The Academia Adventure uses the same board builder as the offline Mathemagine app, and that builder reads the chips in their original order and ignores the saved shuffle.
- The Smartboard and the normal Game already apply the shuffle, so they are not affected.

## Fix
1. In the shared offline/Adventure board builder, apply each line's saved shuffle order to its chips before they reach the Game (only when the shuffle matches the number of chips; otherwise keep the original order, same rule the Smartboard uses).
2. Marking is unchanged: the answer for each line is still the original equation, only the chip display order changes.
3. Your already-assigned questions will show shuffled straight away — no need to reassign, because the shuffle is already saved on them.
4. Offline Mathemagine gets the same fix; students see it after they press Update.

## Checks
- Add a small test: a line saved with shuffle 2, 4, 1, 3 produces chips in that order; a line with no shuffle stays in original order; marking still accepts the correct answer.

## Technical details
- Change: `compileOfflineBoard` in `src/lib/offline/academiaPack.ts` (around line 72) — map `line.fillers` through `line.arrangement` when lengths match.
- Callers covered: `boardFor` in `src/lib/academia/adventureSlots.ts` and the offline pack.
- Normal Game path (`src/lib/smartboard/presentation.ts`) is untouched; no Game-locked files change.
