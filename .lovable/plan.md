# Offline Academia: activities, instant marking, results and history

## What was checked
- The public Academias do have activities with saved questions and answer lines (7 activities, 5 with full questions).
- The offline package sends activities only when their question has more than one line. The two empty "INTRO" items have no question and are dropped.
- The Session screen lists activities under the video, but the exact reason they don't show on your phone is **not confirmed yet**. The likely causes are an old copy saved on the phone before activities were added to the package, or the phone layout hiding the list.

## 1. Find the cause and make activities appear
- Open a real Session in a simulated iPhone screen, in the installed app mode, and compare what the phone has saved with what the package sends.
- When a newer version is online, the app refreshes the saved copy automatically. It shows "Updated" and never drops activities silently.
- On phones the Session screen stacks: video on top, then the activity cards, each with Practice and Play. On laptops the video stays on the left and the activities on the right.
- Activities with no question show "No question yet" instead of disappearing.
- Each activity card shows the teacher's uploaded design or image, saved on the phone so it shows offline.

## 2. Practice and Play that work like the normal Academia
- Line 0 shows the question and can't be edited. Students start solving on Line 1.
- # starts Line 1. Students build each line from the Floating Numbers in the teacher's own pieces and order. The # / undo / redo row sits first, with the Floating Numbers below it, so students type from the bottom up.
- **Practice:** no timer, no time-out messages.
- **Play:** uses each line's own timer set by the teacher, plus the score bar and the line colours (brown = marks awarded, blue = current attempt).
- Back always returns to the Session.
- Videos saved with an activity play offline, following the lines (Auto toggle on by default). YouTube videos still need internet.

## 3. Instant marking with no AI and no internet
- The moment a line is complete and matches the expected line (including correct rearrangements), it is marked right away. Marks, colour and score update together.
- Lines that are only part of an equation, or not equal to the expected line, get no marks.
- This uses the same on-device marking engine as the platform. It needs no AI and no data.

## 4. Results, reports and previous activities
- After each attempt the student sees a result card with the score, each line marked right or not, the time taken, and Try again.
- A new "My results" screen shows every attempt by school, then Session, then activity, with the best score and the latest score.
- "Previous activities" and "Continue learning" appear on the home screen, all stored on the phone.
- Attempts are saved on the phone straight away and sent to the school when there is a connection, as now.

## 5. Check everything still works
- Install, the Safari guide, offline start-up, school search and add, Class to Session navigation, video caching, and the phone Download button.
- Final check in a simulated iPhone screen with the network off: open a Session, do an activity in Practice and in Play, see instant marks, then see the result in My results.

## Technical details
- `academia-pack.ts`: also send line `timerSeconds`, the question design or image path, and `practice_video` when it is a stored file (marked `_aof=1` for offline caching). Keep the vault data out of the package. Send activities that have no lines as empty instead of dropping them.
- `AcademiaApp.tsx`: compare the pack version on every online open and save the new copy, a stacked Session layout on phones, and break `ActivityPlayer` out into `src/pages/academiaApp/OfflineActivity.tsx`. It uses Floating Number taps, per-line timers and line colours, and checks only the current line with `markLine` (predictive equivalence) on every input.
- New `OfflineResults.tsx` reads attempts from IndexedDB. Extend `LocalAttempt` to store per-line results and durations, with a backward-compatible read in `academiaStore.ts`.
- Tests in `src/lib/offline/__tests__`: a complete equivalent line marks immediately, a one-sided fragment scores 0, and an attempt summary computes best and latest scores.
- No AI credits are used.
