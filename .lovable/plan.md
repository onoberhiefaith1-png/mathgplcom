# Game Challenge — Progress Bar Mapping (MathGPL Live only)

Teaching Hub Adventure stays untouched. All changes live in the Live/Smart Card code paths and in new additive columns/tables.

## What's wrong today

When a Smart Card is published as a Game Challenge, the publish step links the card's question to **every** progress bar in the game and goes straight to the public page. There is no time bar reservation, no pass mark, and public progress bars are still driven by class-average logic.

## New teacher flow

```text
Smart Card Editor  →  [Game Challenge]  →  Choose game  →  Progress Bar Mapper  →  Publish  →  Live Dashboard
```

### Progress Bar Mapper (new step, new page)

Reads the selected game's canvas and lists every progress bar:

| Progress Bar | Purpose | Status |
|---|---|---|
| Progress Bar 1 | Time (locked) | Reserved |
| Progress Bar 2 | This Smart Card | Selected |
| Progress Bar 3 | Empty | Available |

Rules:
- Bar 1 is always the Time Progress Bar. Not selectable. Teacher only sets duration (hours / minutes / seconds) and uses Start, Pause, Resume, Reset.
- The teacher picks exactly one of the remaining bars for this Smart Card's question. Bars already taken by another Smart Card show that card's title and are not re-selectable.
- Pass mark input as a percentage; the page shows the derived required marks (e.g. 45 marks × 80% = 36).

Validation gates (block publishing):
- 0 bars: "No Progress Bars exist in this Game. Please add Progress Bars before creating a Game Challenge."
- 1 bar: auto-assigned to Time, then "No Question Progress Bar is available. Add another Progress Bar to this Game."
- 2+ bars: configuration allowed.

## Scoring rules (Live only)

- Each player owns their own bar fill — no class averaging, no shared score.
- Grand total = question total marks (not × number of players).
- Fill target = round(total marks × pass mark %). Reaching it marks the player qualified and records their completion time.
- On reaching pass mark: "Challenge completed. Waiting for the event timer to finish. Final rankings will be calculated when the countdown ends." Timer keeps running; the player can keep playing.

## Winner selection (at countdown zero)

- No qualified players → "No winner", no rewards.
- Otherwise the shortest completion time wins; exact ties all win.
- Each winner receives Trophy, Reward, Gallery item, Winner badge, and a leaderboard position, using the existing reward/gallery transfer code.

## Teacher live dashboard (Live version)

A Live-only dashboard, based on the existing runtime layout but trimmed:
- Removed: Class / Topic / Subtopic / Total Students header block.
- Kept: the game canvas and progress bars (editable by the teacher as today), the Time Bar controls (duration, start/pause/resume/reset, +1m/−1m).
- Status buckets reduced to **In Progress** and **Completed** only — "Inactive" is dropped (there is no roster to be inactive against).
- Participant list shows name, score, % of pass mark, completion time, qualified flag, and a **View work** action opening their board exactly like the teacher viewer does today.
- Header strip: pass mark, participants, qualified count, countdown, reward status.

## Technical notes

Additive migration only (no existing column/table changes):
- `smart_cards`: `game_progress_element_id text`, `pass_mark_pct integer default 100`.
- New `smart_card_game_results` (card_id, participant_key, display_name, score, qualified_at, completion_ms, is_winner, rewarded_at) with RLS: owner reads all, service role writes; public writes go through the edge function only.
- Grants + RLS written in the same migration.

Code:
- `src/lib/smartcards/smartCards.ts`: `linkGameChallenge` writes **one** `class_game_boards` row for the chosen bar with `required_marks` derived from the pass mark, instead of one row per bar; the time bar is excluded and seeded in `game_time_bars`.
- New `src/pages/live/SmartCardGameMapperPage.tsx` + route `/live/smart-cards/:id/game-setup`; the editor's "Game Challenge" button routes here instead of publishing directly.
- New `src/pages/live/SmartCardGameDashboardPage.tsx` for the trimmed teacher dashboard (does not touch `AdventureDashboardPage.tsx`).
- `smart-card-game` edge function: return the mapped bar + pass mark, record per-participant qualification/completion time, and add a `finalize` action that computes winners when the timer expires.
- `SmartCardGamePage.tsx`: fill only the mapped bar from the player's own score, render the completion-waiting message, and show the timer.

Existing engines (Runtime game, progress bars, timer, Smartboard, AI evaluation, instant marking, gallery, rewards) are reused as-is.
