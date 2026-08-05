# Time Bar becomes part of the engine, and Groups report their true status

## What I confirmed in the code

- `src/lib/games/types.ts` already reserves roles: `BarRole = "time" | "learning"`, `nextBarRole()` forces the first bar to be the Time Bar, `TIME_DURATION_OPTIONS` already includes a `No Time` (0 seconds) entry, and `sceneTimeSeconds()` reads the duration off the bar.
- `src/components/adventures/LinkAdventureDialog.tsx` still shows a **Time Bar** row and a whole `timebar_pick` step that calls `timeBarActions.assign(...)`. That is the dialog in your screenshot.
- `src/pages/class/AdventureDashboardPage.tsx` renders `TimeBarControl` only when `timeBar.elementId` exists — and that id comes from a `game_time_bars` row that used to be created by the manual link step. Since nobody links it anymore, the row never exists, so the whole Time Bar section vanished from the dashboard. That is the exact cause.
- `useGameTimeBar` clamps every duration with `MIN_DURATION_SECONDS = 60`, so "None" cannot currently be stored.
- Group gameplay already works: race winner (`recordRaceWinner`), checkpoint judging (`evaluateCheckpoint`), per-group elimination (`qualified`), spectator message, and group-scoped Gallery awards (`class_gallery_awards.group_id`). What's missing is the **status column** on the teacher dashboard — `GroupsPanel` only shows a message when a group is unqualified; it never labels In Progress / Completed / Eliminated / Winner.

## The change

### 1. Link to Adventure — questions only

Delete the Time Bar row, the `timebar_pick` step, and the `timeBarActions.assign` call from `LinkAdventureDialog`. The dialog becomes: pick game → pick **Question Progress Bar** → configure goal. Bars are already filtered with `!isTimeBar(el)`, so the Time Bar can never receive questions. The bar list heading becomes "Question Progress Bar".

### 2. The Time Bar row provisions itself

New helper `ensureTimeBar(gameId, canvas)` in `useGameTimeBar`: when the dashboard opens and the canvas has a bar with `role: "time"` but no `game_time_bars` row exists, insert one automatically (seeded from the bar's `timeDurationSeconds`, default 10 minutes). Teachers never assign it. Called from the Adventure Dashboard and the Video Adventure dashboard.

### 3. Duration select with None

- `MIN_DURATION_SECONDS` clamp becomes "0 or ≥ 60" so `0` (None) is storable; `setDuration(0)` writes 0, and `adjustDuration` no longer drags it off zero.
- `TimeBarControl` swaps the free-text minutes input for a select built from `TIME_DURATION_OPTIONS` (None, 1, 2, 3, 5, 10, 15, 20, 30 minutes — 3 minutes added).
- Duration `0` means: `running`/`expired` are always false, `slotsLit()` returns 0, and no timeout event ever fires.

### 4. Dashboard section is always present

`TimeBarControl` no longer returns `null` when there is no row. Two states, same slot:

```text
Duration: 10 minutes   03:42 remaining   [Resume] [+1 min] [-1 min] [Reset]

Duration: None
No countdown is active for this Adventure.
Enable a duration at any time to activate the countdown.
```

Start / Pause / Resume / +1 / -1 / Reset / live countdown / remaining time / gameplay sync all stay exactly as they are today; the destructive **Remove** button goes away, since the Time Bar is now part of the engine and is never deleted. Switching None → 10 minutes restores the timer with no extra setup.

### 5. Gameplay honours None

In `GamePlayPage` and the presentation/student mirrors, when the effective duration is 0 the Time Bar is not drawn and no timeout/elimination is evaluated — students play until they finish. Video Adventure keeps its existing publish guard (every Learning Point still needs a duration).

### 6. Group status on the dashboard

Add a shared `groupStatus(group, fill, winnerGroupId)` helper returning `Winner | Completed | Eliminated | In Progress`, and show it per group in `GroupsPanel` next to name, student count, progress, achieved/target marks and (Video Adventure) current Learning Point. Eliminated groups render read-only — their bar stops advancing and clicking it shows the teacher's encouraging message instead of opening questions.

## Scope

UI and runtime only. No schema change — `game_time_bars`, `adventure_groups` and `class_gallery_awards` already carry every field needed. Existing adventures pick the Time Bar row up automatically the next time their dashboard is opened.

## Files

- `src/components/adventures/LinkAdventureDialog.tsx` (remove Time Bar step)
- `src/hooks/useGameTimeBar.ts` (`ensureTimeBar`, allow 0 seconds)
- `src/components/adventures/TimeBarControl.tsx` (duration select, always-visible section, None copy)
- `src/pages/class/AdventureDashboardPage.tsx` and the Video Adventure dashboard (provision + always render the section)
- `src/pages/student/GamePlayPage.tsx` (skip countdown when None)
- `src/components/adventures/GroupsPanel.tsx` + `src/lib/adventures/groupCompetition.ts` (status column, read-only eliminated groups)
