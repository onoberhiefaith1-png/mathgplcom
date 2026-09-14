# Game + Floating Numbers integration — Stage A (teacher side)

The Game Slate stays exactly as it is. This stage builds the ownership model around it: the Game holds the world and the repeating reward pattern, and the mathematics, marks and timing come from Floating Numbers questions.

## Terminology (enforced)

- **Game** — the world: room, surface, background, text look, number of pattern Lines, reward pattern.
- **Line** — a physical writing/reward position. Lines stay numbered 1, 2, 3, …
- **Question Line (Line 0)** — one extra read-only Line placed before Line 1, rendered by the *same* existing Line component and styling. It holds the question, is never writable, and is outside the reward pattern.
- **Question** — a mathematics problem coming from Lesson Notes / Floating Numbers, carrying its own marks and its own optional timing.
- The word "Session" is removed from the Game system.

## 1. Games move to the account

Games currently live only in the browser (`game-slate:games`). They move into the account so questions can be assigned and, later, students can play.

- New storage for a game record: name, topic/subtopic, surface, room, background, full settings JSON, and the pattern Lines with their rewards.
- The existing save/load/list/delete calls keep the same shape, so the editor and gallery are untouched apart from being asynchronous.
- Anything already saved in the browser is offered as a one-time import into the account, so nothing the teacher built is lost.
- Ownership: a teacher sees and edits only their own games.

## 2. Lines become a repeating reward pattern

The teacher chooses a pattern length (5, 10, 15, 20, …) and places rewards on those Lines. Empty Lines stay empty.

- Pattern applies by position: Game Line N uses pattern slot `((N - 1) mod patternLength) + 1`.
- A question with 15 solving lines and a 5-Line pattern repeats the pattern three times; 7 lines uses the pattern once plus its first two positions.
- The Question Line never takes a pattern position and never shifts the pattern.
- Rewards are never auto-inserted into positions the teacher left empty.

## 3. Questions are assigned, not re-authored

- A teacher picks existing Floating Numbers questions (from Lesson Notes) and assigns them to a Game in order: Question 1 → Question 2 → …
- The Game stores only a reference to the question plus its position. No mathematics, chips or lines are copied into the Game.
- Reordering and removing assigned questions is supported.
- Editing the question in Lesson Notes is immediately reflected in the Game, including a changed number of lines.

## 4. Timing lives with the question, never in Game settings

Two separate things, configured only in Floating Numbers:

- **Question Timer** — off by default, sitting next to Marks. When switched on the teacher sets a time for the whole question. A "set the same time for all questions" action with per-question override.
- **Line Timer** — a per-line time on a single Floating Numbers line. Setting it is the only way a Timer Reward exists; a line can have at most one, and re-saving never duplicates it.

Game settings gain no timer controls at all, and Timer Reward cannot be placed by hand from the reward pattern.

## 5. Preview of the combined result

The Game editor gets a read-only preview per assigned question showing exactly what the student will meet:

```text
Line 0   QUESTION (read-only)   Solve: 2(x + 3) - 4x = 8
Line 1   solving line           2 Coins
Line 2   solving line           1 Coin
Line 3   solving line           1 Life
Line 4   solving line           —          + Timer Reward (10s, from Floating Numbers)
Line 5   solving line           1 Coin
Line 6   solving line           2 Coins   (pattern repeats)
```

This makes the mapping visible before students ever play, and confirms Game Line N maps to Floating Numbers Line N.

## Stage B (next, not built now)

Student play: selecting a Line to open the existing Floating Numbers interface on that line, solving, reward collection, Timer Reward starting on the first symbol entered, question timer, lives, coins, buying a life, question progression, and reset — all reusing the existing Smartboard/Floating Numbers logic rather than a second engine.

## Technical notes

- New tables: `slate_games` (settings + pattern JSON, owner-scoped) and `slate_game_questions` (game, position, notebook/question reference). Both get RLS scoped to the owner plus the usual grants.
- `src/lib/slate/storage.ts` gains a cloud-backed implementation behind the same function names; `src/lib/slate/types.ts` gains `patternLength` and a `questionLine` marker. `Slot` keeps its current shape so `WritingLayer`, `RewardLayer` and the 3D world are unchanged.
- Reward resolution becomes a pure function `rewardsForLine(game, lineIndex)` used by both the editor preview and Stage B gameplay.
- Question Timer and Line Timer are stored with the question's Floating Numbers data (`notebook_subsections` floating lines already carry `marks`; timing is added alongside it) — no timer state is written into game records.
- Line 0 renders through the existing Line component with writing disabled; no new visual component is introduced.
- No changes to Lesson Notes generation, Smartboard, Classes, Adventure or Courses behaviour.

## Verification

Typecheck, focused tests for pattern repetition (including empty positions, pattern shorter/longer than the question, and Line 0 exclusion), timer-uniqueness tests, and loading `/game` plus a game with an assigned question in the preview to confirm the Slate renders unchanged.
