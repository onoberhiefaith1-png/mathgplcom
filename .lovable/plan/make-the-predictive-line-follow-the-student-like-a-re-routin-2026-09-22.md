# Make the Predictive Line follow the student, like a re-routing map

## What is wrong now

On Line 2 the teacher's line is `x + 7 - 7 = 12 - 7`. The student has written `12 - 7`,
but the Predictive Line still reads `x = 12 - 7`.

The route engine currently returns whichever completion is *shortest*, and it is allowed
to put the student's own writing at the end of the route. So it rebuilds a line that
starts somewhere else instead of continuing from what the student actually wrote.

## The rule we want

Predictive Line = what the student has written **so far**, plus the shortest valid
continuation to an equivalent line.

- Nothing written yet: Predictive Line is exactly the expected line (the first guess is
  "this student will follow the map").
- Student writes `x + 7 - 7`: prediction stays on the expected route, unchanged.
- Student writes `12 - 7`: prediction recalculates to `12 - 7 = x + 7 - 7`.
- Student continues `12 - 7 =`: prediction recalculates again, still starting with the
  student's text, e.g. `12 - 7 = -7 + 7 + x`.
- The student's written part is never rearranged or moved to the back.
- If no continuation from the student's text can reach an equivalent line, show the
  existing "no valid route" state rather than inventing a different line.

## How it will be built

`src/lib/predictive/predictiveLine.ts`

- Rank candidate routes instead of taking the first hit:
  1. student text first, remaining Floating Numbers appended (preferred, shortest wins);
  2. only if no such route exists at all, fall back to the current insert-before route.
- Keep the breadth-first search, the same node/atom budgets and the same cached route
  maps, so cost per keystroke is unchanged.
- Empty student text returns the expected line verbatim.
- Keep using the existing `equationsEquivalent` canonicaliser — no new mathematics.

`src/lib/game/inspector.ts` / `GameEvaluationPanel.tsx`

- Show the recalculated predictive line and the remaining pieces; no other panel change.

Untouched: marking and scoring (still authoritative), Vault exact-sequence behaviour,
rewards, notes, Smartboard and Assignment evaluation UI, surfaces, rooms and camera.

## Verification

- Unit tests over the pictured line `x + 7 - 7 = 12 - 7`: empty, `x + 7 - 7`, `12 - 7`,
  `12 - 7 =`, and a dead-end input.
- Live check in the saved Game: type/tap `12 - 7` and confirm the panel's Predictive Line
  changes to a line beginning with `12 - 7`, with score and Vault behaviour unchanged.
