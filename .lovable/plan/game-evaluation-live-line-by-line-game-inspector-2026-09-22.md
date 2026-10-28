# Game Evaluation — live line-by-line Game Inspector

A new teacher-only inspection panel inside the Game. It watches the Game and explains, for the **current active line only**, what the engine is doing. It adds no mathematics, no marking and no reward logic of its own. The Smartboard evaluation and the Assignment/Student Dashboard evaluation are not touched.

## What the teacher gets

- A small brain/AI Evaluation button at the bottom-right of the Game, visible only when the teacher is playing or testing their own Game. Click to open, click to close.
- The panel always shows the line the student is on. Move to Line 2 and the panel switches to Line 2 instantly — no Line 1 information stays behind.
- Sections, top to bottom:
  1. **Active line** — line number and whether it is the question line or a solving line.
  2. **Expected line** — the exact mathematics the teacher configured for this line.
  3. **Student line** — what is written right now, updating as it is typed.
  4. **Mathematical evaluation** — Not started / In progress / Incomplete / Equivalent detected / Not equivalent / Correct / Completed.
  5. **Score** — Pending or Awarded, shown separately from equivalence. If the engine reports equivalence but no mark was awarded, the panel says "Equivalent detected / Score pending" as a flagged inconsistency.
  6. **Note** — Locked until this line's mark is awarded, then Unlocked. It never says unlocked because a line was selected, something was typed, lines were changed, or a Vault opened.
  7. **Rewards on this line** — exactly the rewards configured for this line, nothing invented. Each one lists its type, its condition in words, whether the condition is met, whether it activated, and whether it was awarded or consumed. Vault shows the required exact sequence and makes clear that opening a Vault never awards the line score. Hourglass shows a live countdown and, after a win, the time it paid using the Reward Conversion factor. A line with no Hourglass shows "Hourglass — none".
  8. **Game resources** — time remaining, Life, Vault opened/total, Completion coins, current line, lines completed out of total.
  9. **Live activity** — a short rolling feed of real events: line started, input updated, Vault condition met, Vault unlocked, equivalent detected, score awarded, note unlocked, hourglass started/expired, time awarded.

## Rules kept intact

- One shared active-line state. The panel reads the Game's current line; it never sets it.
- The Game stays the source of truth. No second mathematical, scoring or reward engine.
- Opening the panel cannot pause, block or slow typing, Floating Numbers, rewards or animations. It only re-renders its own view, and only for values that actually changed.
- Vault activation stays exact-sequence and stays separate from line completion and score.

## Technical notes

- New `src/components/gameslate/GameEvaluationPanel.tsx` plus `src/lib/game/inspector.ts` (pure derivation + condition wording, unit tested). No state of its own beyond the event feed and open/closed flag.
- Inputs are all existing values from `useGameRuntime` (`currentLine`, `lines`, `completedLines`, `consumedRewardKeys`, `vaultReward`, `vaultsOpened/Total`, `timedLine`, `lineDeadline`, `questionDeadline`, `completionCount`, `lives`, `earnedMarks/totalMarks`, `onLineContext` award fields) and `lineText` already held by `GamePlayPage`. Reward lists come from `rewardsForLine`; Vault codes and hourglass seconds from `lines` (`mapQuestionLines`). Hourglass paid time uses the existing `conversion` factors.
- Expected line text comes from the teacher-owned `assessment_answer_keys` row for the Game's hidden assessment (`equationAscii` per `lineId`), loaded once per question. Owner-only policy already exists, and the panel only mounts in owner Play/Test, so no student ever receives it.
- Grading verdicts are surfaced by an additive read-only reporter on `PresentationView` (`onGameInspect`, called where the existing `broadcastCheckResultRef` already fires). It reports questionId, lineId, verdict, correct, marks and the student expression. No grading behaviour, order, request handling or existing callback changes.
- Panel renders in a fixed overlay above the canvas with its own pointer boundary, so it cannot steal taps from writing surfaces or rewards. Countdown ticks come from the existing canonical clock, not a new interval.
- Tests: inspector derivation (status ladder, equivalent-but-unawarded flag, note gating, per-line reward lists, Vault exact-sequence wording, no-hourglass case, line switch clearing). Then a live Playwright pass on the saved room Game verifying Line 1 with only `x + 7` shows Vault opened, score pending, note locked, and that completing the line flips score and note.
