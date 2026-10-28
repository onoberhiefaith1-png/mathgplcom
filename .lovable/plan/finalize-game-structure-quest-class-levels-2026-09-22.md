# Finalize Game structure — Quest / Class / Levels

The Game engine, Game Slate, Floating Numbers, rewards, timers, lives, predictive evaluation, sound, scoring and Game Evaluation stay exactly as they are. This pass changes only how questions, levels, progress and entry points are organised.

## 1. A Game is a reusable container

The Game keeps only its design: background, sounds, visuals, rewards, timer/life settings. Questions no longer belong to the Game itself.

## 2. Class + Game = one playable Game

Questions are attached to a class-and-game pair, so:

```text
Quest + SS1  ->  Q1, Q2, Q3
Quest + SS2  ->  Q4
```

Order, progression, scores and ranking all belong to that pair. Nothing leaks between classes.

Existing questions are migrated once: every class already linked to a Game receives its own independent copy of that Game's current questions, keeping content, marks, order, Floating Numbers, timers and rewards. Editing one class's copy never touches another's. The migration is one-time and never duplicates on later opens.

## 3. Questions become Levels

Inside one playable Game, each question is a Level. Finishing a Level moves straight into the next one — no completion screen, one continuous journey.

## 4. Teacher arrangement

- The Game editor's Questions panel stays but gains a class selector at the top: the teacher picks SS1 and sees/arranges only SS1's questions.
- A small Arrange icon in the teacher's Play/Evaluation area opens the Level list with move up / move down. The saved order is the order students play. Reordering never duplicates a question.

## 5. Play starts with Select Class

Pressing Play on a Game shows a Select Class step listing only the classes linked to that Game. Choosing one opens that class's playable Game with that class's Levels. Students skip this step — their class card opens their own instance directly.

## 6. Student Level map

A journey map replaces any question list: level nodes joined by a path, showing completed, current, locked and upcoming at a glance, scrollable.

Two map styles, chosen by the teacher per Game:
- **Winding path** (default) — circular nodes along a curved journey.
- **Map over game art** — the same nodes laid over the Game's own background art.

Tapping a node opens the existing Game runtime. The map is presentation only.

## 7. Progression, locking, memory

- Teacher option **Lock progression**: each Level unlocks when the previous one is completed. Completed Levels stay replayable. When off, existing navigation applies.
- Current Level, completed and unlocked Levels, score and run state are remembered per Class + Game + Student. Leaving at Level 4 returns to Level 4.

## 8. Lives, time, restart

- New setting **Starting lives**: 1–5, default 3, maximum 5.
- Restart replays the current Game from its start state, resets lives to the configured start, and costs no life. Nothing carries into another Game.
- When time expires the Game does not restart: one life is consumed, the configured continuation time is added and play continues. With no life left, the existing game-over behaviour applies.

## 9. Reporting — unique marks only

Game already appears beside Assignment, Adventure and Course in Reports. It gains a best-ever rule: if a student earns 15/40 and restarts, the visible run resets but the report keeps 15. Re-earning the same marks adds nothing; new marks are added. The report can never exceed the Game's maximum.

## 10. Game card in class

- Student card: game name, current Level, progress, score, status.
- Teacher card: game name, students assigned, current Level/progress, scores, who is Active right now. Opening it enters the existing Game Evaluation view (kept separate from Smartboard Evaluation).

## 11. Guest Link and Add to building

Reuse the existing Assignment/Adventure implementations rather than writing a third one. A guest link or autoplay entry opens the correct Class + Game instance with its own questions, Level order and progression.

## Technical notes

- Migration: add `class_id` to `slate_game_questions` (referencing `classes`, with RLS and grants matching the existing table), a per-instance `position`, and a uniqueness rule on `(game_id, class_id, subsection_id)`. Backfill by copying each Game's existing rows into every linked class in `slate_game_assignments`, then keep the originals as the teacher's unscoped fallback set.
- Add to `slate_game_assignments`: `lock_progression` (boolean), `starting_lives` (1–5, default 3), `level_map_style`. Add `best_marks_earned` to `slate_game_results` so the report keeps the maximum while the live run resets.
- `listGameQuestions`, `ensureGameBoards`, `loadGameBoards`, `summariseGame` and `listStudentGameAssignments` take a `classId` and filter on it; `assignQuestion` and `reorderQuestions` write class-scoped rows.
- `slate_game_progress` continues to key on `assignment_id + student_id`; add `unlocked_question_ids` for locking and resume.
- New UI: `SelectClassDialog` before Play, `GameLevelMap` (two styles), `LevelArrangeDialog`, class selector in `QuestionsPanel`, Game cards on the class dashboards.
- `useGameRuntime` changes only at the seams: starting lives from the assignment, time-expiry consuming a life instead of restarting, and advancing to the next Level without a completion screen.
- Tests: class isolation (SS1 vs SS2), reorder without duplication, resume at Level 4, locked Level 3, restart not inflating the report, guest link opening the right instance.
