# Video Adventure: Teacher-Led Live Game with Per-Learning-Point Time Bars

Static Adventure is untouched. Everything below only applies when the adventure has a video (Video Adventure).

## What changes for you

**The dashboard becomes the live game screen.**

- Opens with the video showing its first frame at 0:00, nothing running.
- One button starts everything: **Start Game**. Time Bars never start the game.
- While the video plays outside a Learning Point, the dashboard is clean — no Progress Bar strip, no Time Bar, no timer or pass-mark settings.
- The moment the video reaches a Learning Point, that point's challenge appears: its Progress Bar, its Time Bar counting down, and two live settings — **Time** (default 10 minutes) and **Required Mark** (default 100%). You can change them while that point is active; other points are unaffected.
- The challenge ends when the required mark is reached or the timer expires. Progress Bar, Time Bar and its settings all disappear, and the video continues to the next Learning Point.
- Before the game starts you can still edit any Learning Point's Time Bar one at a time, with **▲ Previous / ▼ Next** navigation showing only the selected one (Time Bar 1, Time Bar 2, …).

**Students follow the teacher.**

- A student who opens an assigned Video Adventure before Start Game sees a waiting screen; tapping a Progress Bar shows "The teacher has not started this Video Adventure yet. Please wait for your teacher to begin the game." No questions open.
- After Start Game each student's video syncs to the teacher's position and stays synced; students cannot scrub or pause the timeline.
- Questions unlock only while the teacher's video is inside a Learning Point, and lock again when that challenge ends. Each student still answers on their own device and their marks are recorded individually.

## Technical plan

### 1. Database (additive; nothing existing is dropped)

New `public.video_adventure_runs` — the master clock, one row per class+game:
`class_id`, `game_id`, `started_at`, `playhead_seconds`, `playing`, `active_scene_id`, `ended_at`. Realtime enabled. Teacher (class owner) writes; class members read.

New `public.video_adventure_challenges` — one row per Learning Point occurrence:
`class_id`, `game_id`, `scene_id`, `progress_element_id`, `duration_seconds` (default 600), `required_pct` (default 100), `started_at`, `paused_at`, `accumulated_paused_ms`, `ended_at`, `outcome` (`completed` | `expired`). Unique on (class_id, game_id, scene_id). Realtime enabled; same access rules.

`game_time_bars` (PK `game_id`) is left as-is for Static Adventure.

### 2. New hook `src/hooks/useVideoAdventureRun.ts`

Reads/subscribes to the run row and the challenge rows; exposes
`run`, `challengeFor(sceneId)`, `activeChallenge`, `remainingMs`, `expired`,
and actions `startGame()`, `publishPlayhead(t)`, `openChallenge(scene)`,
`endChallenge(sceneId, outcome)`, `setDuration`, `setRequiredPct`.
Teacher-only actions no-op for students (RLS also enforces it).

### 3. Dashboard `src/pages/class/AdventureDashboardPage.tsx`

- Branch on `adventureModeOf(canvas) === "video"`.
- Render `VideoBackgroundLayer` (same component the editor/gameplay use) behind `GameCanvas`, seeked to 0 on mount, paused until Start Game. Publish the playhead (≈1s throttle) to the run row.
- On entering a scene's `[loopStart, loopEnd)` region: `openChallenge` (creating the row with the 10-minute / 100% defaults if absent). On required mark reached (existing `patchedBarSummaries` vs `required_pct`) or timer hitting zero: `endChallenge` and let the loop's exit lap play out via the existing `loopRuntime` rules.
- Show the per-bar summary strip, the Time Bar and the Time/Required Mark selects **only** while a challenge is active; hide them otherwise.
- Replace the single `TimeBarControl` with a new `src/components/adventures/LearningPointTimeBars.tsx`: pre-game, one Time Bar at a time with Previous/Next; in-game, the active challenge's live controls (countdown, Time select, Required Mark select).
- Static Adventure keeps today's `TimeBarControl` and full bar strip unchanged.

### 4. Student `src/pages/student/GamePlayPage.tsx`

- For video adventures, replace local `activeCpId` / `cpSecondsLeft` ownership with the run row: seek/play to `run.playhead_seconds`, correct drift beyond ~1s, ignore student seek/turn-back controls.
- `openBarId` gating: if no run row or `started_at` is null, show the "teacher has not started" message instead of the board; if the bar's scene is not the active challenge, keep it locked.
- Static adventures keep the current independent flow.

### 5. Types / helpers

Add `DEFAULT_LP_DURATION_SECONDS = 600` and `DEFAULT_REQUIRED_PCT = 100` plus a `REQUIRED_MARK_OPTIONS` list (40/50/60/80/100) to `src/lib/games/types.ts`, and reuse `TIME_DURATION_OPTIONS` for the Time select.
