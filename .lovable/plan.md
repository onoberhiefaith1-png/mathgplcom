# Playable Game runtime — Game never opens Adventure

Today the Class Games page lists the old game system, which is why opening a Game launches the Adventure experience. This plan adds the real Game Play experience and points every Game entry at it.

Nothing in Smartboard, the student Floating Numbers design, the Game Slate or Adventure is redesigned. The Game world stays exactly as built; the existing student Floating Numbers interaction layer is brought in front of it and connected to the Game Lines.

## What the student gets

1. Opens an assigned Game from their class and lands straight in the Game world — no editor, no Adventure.
2. Header shows Game name, topic, Question x of y, progress, coins, lives and the countdown time (mm:ss) when the question has one.
3. The question is Line 0 on the slate: read-only, no reward, not a solving line.
4. Solving happens in the existing student Floating Numbers layer in front of the slate, working on the currently active Game Line.
5. Completing a line correctly awards its marks, then the rewards belonging to that line are collected and disappear — coins and lives go into the header, an hourglass adds its time, and a spent reward can never be collected again.
6. The next line becomes active. When the last line is done the question is complete and the next question loads automatically. After the last question: Game Complete with total marks, achieved marks, percentage, pass mark and pass/not passed.
7. Leaving and returning restores the exact place: current question, current line, completed lines, coins, lives, marks and rewards already spent.

## Rules the runtime follows

- **Reward pattern** repeats every `patternLength` lines regardless of how many lines or questions exist. Empty positions stay empty.
- **Question timer** comes from the teacher's Floating Numbers setting and is never asked of the student. At 00:00 the question fails: one life is spent and that question restarts; with no lives left the Game resets to Question 1 while nothing else is fabricated.
- **Line timer** (a Floating Numbers line time) automatically shows the hourglass on that Game Line. It starts on the student's first real input on the line, not on arrival. Finish in time and the configured extra time is added and the hourglass is consumed; run out and the hourglass simply dissolves — the question is not failed.
- **Maths Reset** clears only the current line's working. It never touches coins, lives, completed questions or Game progress. That is separate from the Game failure reset.
- **Marks** always come from the Floating Numbers question, so changing marks there changes the Game total automatically.
- Game Lines drive which line is active; the Smartboard three-line sensor navigation is not used, and the student cannot jump to a line ahead of the current one.

## Teacher side

- Game Board keeps every authoring control and gains **Play Game**, which opens the same runtime students use (same engine, same maths, same rewards and timers) with an **Exit Play** control. Nothing is recorded from a teacher test sitting.
- Class Games lists the assigned Games only, with Game name, topic, question count, total marks, pass mark, and per-student status: Not Started / In Progress / Completed with score. Editing stays on the Game Board. The Adventure links on that page are removed.

## Technical section

- New route `/game/play/$gameId` with optional `?class=<id>` and `?mode=test`, rendered by a new `src/pages/game/GamePlayPage.tsx`. Class and student Game entries link here; the legacy `class_games` list and its Adventure links are dropped from `ClassGamesPage.tsx`, and `StudentGamesPage.tsx` Play stops pointing at the editor route.
- The play page renders the existing `WorldStage` (view mode, no editor panels, no selection) behind the existing `PresentationView` mounted with `role="student"`, `source` built from the question's saved `floating_lines`, `gameId`, `workspace: "game"` (new value added to `BoardWorkspace`), `testMode` for teacher play, and `onLineContext` as the completion/engagement signal. No second maths engine and no change to `PresentationView`'s existing behaviour beyond accepting the new workspace value.
- New `src/lib/slate/boardSource.ts` converts a `GameQuestion` (from `gameQuestions.ts`) into the `AssessmentLike` shape `buildAssessmentBoardSource` already consumes, so chips, tables, containers and marks transfer unchanged.
- New `src/hooks/useGameRuntime.ts` owns progression: line map from `mapQuestionLines`, reward collection per line, coins/lives, question timer, line-timer start-on-first-input, question/game completion and score. Game stays time-agnostic — all times are read from Floating Numbers.
- New migration adds `slate_game_progress` (assignment/game, student, current question, current line, completed lines, completed questions, coins, lives, marks, consumed reward ids, status, timestamps) with GRANTs and RLS: student writes their own row, assigning teacher reads. Completed questions continue to write `slate_game_results` through the existing `saveGameQuestionResult`.
- Rewards, bomb, horizontal and vertical collectors, hourglass and every 3D material stay as implemented in `components/gameslate/world` and `lib/slate/rewards.ts`; the runtime only tells them which line completed.
- Tests: reward-pattern-to-line mapping with Line 0 excluded, reward consumption not repeatable, question-timer life/reset behaviour, line-timer award and expiry, score/percentage/pass, and progress restore. Existing focused suites and typecheck must stay green.

Real-time teacher viewing of a live student Game and the full Game report columns are the follow-up step after this runtime works.
