## Goal

Connect the existing pieces (progress bar → winner → timer → reward exit → Gallery flight) into one continuous flow. No Gallery animation rebuild, no new UI.

## Verified current state

- Winning is already goal-based, not hard-coded: `useAdventureSync` computes `required = grand * (goalPct / 100)` per bar, and `useRewardTransfer` fires when `achieved >= required`. This stays as is.
- `useRewardTransfer` already awards to `class_gallery_awards` and navigates to the Gallery with `?animateReward=gameId:elementId&group=…`.
- The Gallery flight (Start → End at `duration_ms`, then permanent) already works in `useGalleryAwards`, used by both the student Gallery and the teacher Gallery view.
- Gaps found: (1) the exit "lift" is a single instant position jump — `GameCanvas` applies no CSS transition, and the hook uses a fixed `EXIT_MS = 1400` rather than the teacher's Gallery speed; (2) the timer is never paused when a bar fills — `useGameTimeBar.actions.pause` exists but nothing calls it on a win; (3) the game only freezes on Time Up, not on a win — students can still open bars and answer.

## Changes

**1. `src/hooks/useRewardTransfer.ts`**
- Derive exit duration from the winning reward's `duration_ms` (the Gallery animation speed) instead of the constant `EXIT_MS`; fall back to 2000 ms only when no placement exists.
- Replace the single position jump with a requestAnimationFrame loop that publishes a continuous `exitProgress` (0 → 1) over that duration, exposed as a per-element offset map (`y` offset and fading `opacity`), so the reward glides upward off the top edge.
- Only after the exit completes: write the award rows, then navigate to the Gallery (unchanged URL contract).
- Expose `won` (a bar is full) and `winnerGroupId` so callers can freeze and pause.

**2. `src/pages/student/GamePlayPage.tsx`**
- Use the new continuous offsets when rendering departing rewards (smooth lift + fade instead of a jump).
- Freeze play on a win the same way Time Up already freezes it: hide bar hotspots, close the open question panel, and block navigation into the assessment board.
- When `transfer.won` becomes true and the time bar is running, call `timeBar.actions.pause()` once so the displayed time freezes.

**3. `src/pages/class/AdventureDashboardPage.tsx`**
- Same two behaviours on the teacher side: smooth reward exit using the shared offsets, and a single auto-pause of the time bar when a winner is declared (teacher is the row owner, so the pause write is authoritative).

**4. Freeze the answering path**
- In the student assessment entry from Adventure, refuse to open / return to the board once the owning game has a declared winner, so no further marks land after the win.

## Notes

- Steps 4–9 of your flow (open Gallery, start position, saved path, end position, permanent save) already work through `class_gallery_awards` + `useGalleryAwards`; they're only being reached more reliably here.
- Step 7 (reward gone from the Adventure) already works via `transferredIds` filtering and stays untouched.
- No database migration is needed — `duration_ms` already lives on `class_gallery_rewards`.
