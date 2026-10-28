# Free line choice in Game Play — any line, any order

Goal: while playing, a student may put the sensor on any writing surface (1, 2, 3, 7…) and the Floating Numbers panel must move to that exact line and stay there.

## What the reads confirm

The Game already hands the chosen line to the solving panel correctly:

- `GamePlayPage.tsx:327` passes `activeLine = currentLine - 1`, and `onActiveLineChange` writes back through the single `setActiveLine`.
- `PresentationView.tsx:3537-3555` applies the Game's line to the panel's one cursor and publishes panel changes back.
- `useGameRuntime.selectLine` allows every line from 1 to the last solving line.

So the outward wiring is right. What is not confirmed is which of the panel's own guards pulls the cursor back after the jump. The panel contains several mechanisms that move the active line by themselves, each written for guided sequential solving:

1. `PresentationView.tsx:4839-4872` — when the active line ends up empty, the cursor is handed back to the "last unfinished line".
2. `PresentationView.tsx:~4020-4060` — an "ink was lost on this line" rewind that sets the active line back to the line it believes was erased.
3. `PresentationView.tsx:3696-3699` — the sensor anchor clamps the target line to the number of lines the assigned solution has.

Any of these can fire on a jump to an empty line further down, which matches the reported bounce back to line 2. The plan therefore starts by identifying the one that actually fires, instead of guessing.

## Step 1 — Identify the guard (temporary, removed before finishing)

Add temporary logging inside each of the three mechanisms above, open the user's Game in Play with an authenticated browser session, click surface 3, and read which mechanism reports the reverting change. This confirms the cause with evidence.

## Step 2 — Make the Game's chosen line final

Only in Game Play (the existing `gameChrome` flag, so Lesson Notes and Smartboard behaviour is untouched):

- The line the Game selected becomes authoritative. The guards above may still freeze, grade and record work, but they may no longer move the active line.
- Remove the line-count clamp for the Game path so the last line is reachable like any other.
- Visiting an empty line stays a normal visit: no attempt is created, nothing is graded, and the cursor does not travel back.
- A jump still parks the writing sensor on that line's own row so the next character lands on the correct surface.

## Step 3 — Keep everything else as it is

Marking, rewards, timers, Vault codes, Hourglass, completion effects, the fixed camera, saved surface appearance and the 5%–95% writing band are unchanged.

## Verification

- Focused Game tests, plus a new test that selecting the last line keeps it selected.
- Live authenticated check on the user's Game: click surfaces 1, 3, 2, then 3 again; each time the panel shows the same line number and stays there; type on line 3 and confirm the work appears only on surface 3.
