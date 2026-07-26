
# Activate the Timer Controls

## What I verified
- The buttons are already wired to `timeBarActions` in `src/components/adventures/TimeBarControl.tsx`, and the database writes **do** succeed: the row for the adventure currently open (`4996cb5d…`) has `duration_seconds = 540` and a `started_at` timestamp, even though the on-screen UI still shows `10` min, `00:00 / 10:00` and a "Start" button.
- So the failure is not the logic or permissions — it's that the UI never re-reads the row. `src/hooks/useGameTimeBar.ts` updates its local state **only** from a realtime `postgres_changes` subscription; the mutation helpers write and discard the result, and nothing refetches. When that subscription doesn't deliver (auth timing, channel not yet joined), the panel stays frozen on the value loaded at mount.

## Fix (no redesign, no visual changes)

**1. Mutations return the new row and update state immediately**
- In `useGameTimeBar.ts`, have every mutation (`setDuration`, `adjustDuration`, `start`, `pause`, `resume`, `reset`) use `.select().single()` and hand the returned row back.
- Move the actions from the free-standing `timeBarActions` object into hook-bound callbacks (keeping `timeBarActions` exported for any other caller) so each action can call `setRow(returned)` right after the write.
- Realtime stays as-is and simply reconciles; the local apply makes the display, the `mm:ss` totals and the lit-slot count update instantly with no refresh.

**2. +1 / −1 minute**
- `adjustDuration` keeps its ±60s step; change the floor from the current `10` seconds to `60` seconds so the duration can never drop below 1 minute (and never negative).
- Because slots are derived (`slotsLit` = `elapsed ÷ (duration ÷ segments)`), time-per-slot recalculates automatically the moment `duration_seconds` changes — nothing else to add.

**3. Duration input**
- Keeps working as today (min 1 minute), now with immediate local echo so typing/committing a value reflects at once. Editing before start is unaffected.

**4. Reset**
- Spec asks Reset to restore the *originally saved* duration. There is no column holding it today, so add one additively: `game_time_bars.default_duration_seconds` (backfilled from the current `duration_seconds`, set on insert).
- Reset then clears `started_at`, `paused_at`, `accumulated_paused_ms` **and** restores `duration_seconds` to `default_duration_seconds`, returning the bar to `00:00 / original` with 0 slots lit, ready to start again.

**5. Show failures instead of swallowing them**
- Surface any write error with a toast so a permission/network failure is visible rather than looking like a dead button.

## Technical notes
- Files: `src/hooks/useGameTimeBar.ts` (main change), `src/components/adventures/TimeBarControl.tsx` (use the hook-bound actions; markup untouched).
- One additive migration: add `default_duration_seconds integer` to `public.game_time_bars` with a default and a backfill. No existing columns or tables modified.
- `src/hooks/useTimeBar.ts` / `TimeBarControls.tsx` (student & class-live views) are read-only consumers and stay as they are.
