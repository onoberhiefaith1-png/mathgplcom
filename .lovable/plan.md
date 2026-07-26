## What I verified

- The class in the screenshot (`kg3` → quadratic quest) has **no reward placement rows at all** — `class_gallery_rewards` is empty for every class in the project, so `useRewardTransfer` loads zero placements and `run()` returns immediately. That alone means nothing can lift out and nothing can land in the Gallery.
- The Time Bar in the screenshot reads **`03:00 / 03:00` – Time expired**. The transfer hook deliberately bails when `timeExpired` is true (Part 7 rule: time beat the group → no reward). So even with a reward configured, this particular run would still do nothing.
- The Progress Bar itself is correct: Goal 96%, Achieved 42/42 → the bar *is* full, `won` would be true if time had not expired.

So "nothing happened" has two real causes, and neither is a bug in the animation code — they're an unconfigured reward plus a silent, unexplained bail-out.

## Plan

**1. Never fail silently — explain the block on the dashboard**
In `AdventureDashboardPage.tsx` (and the same strip in the student `GamePlayPage.tsx`), when the bar is full show a small status line next to the Progress Bar:
- "Goal reached — transferring reward…" while the exit animation runs.
- "Goal reached, but time had already expired — no reward transferred." when `timeExpired`.
- "Goal reached, but no reward is linked to this Adventure for this class." when there are zero placements, with a direct link to the Gallery reward setup for this game.

**2. Expose the block state from the hook**
`useRewardTransfer` currently returns only `won`/`transferring`. Add a `blockedReason: "time_expired" | "no_reward" | "already_awarded" | null` derived from the state it already computes, so both pages can render the message above without duplicating logic.

**3. Add a "Link reward to Gallery" entry point**
From the Adventure dashboard, add an action that opens the existing Gallery reward-config route (`GameEditorPage` in gallery mode with `?rewardGame=<gameId>&rewardElement=<elementId>`) for each reward element found in this game's canvas. This is wiring only — the reward-placement editor already exists and is untouched.

**4. Re-arm the trigger when the block clears**
Today `firedRef` latches once. Change it so it only latches after a transfer actually starts; if the run bailed (no placements yet, or placements loaded late), a later state change can still fire it. Also allow firing when the goal is already met on page load.

**5. Decide the time-expired-but-full case**
Keep the current Part 7 behaviour (no reward). The new message makes it visible instead of looking broken. Resetting the Time Bar and re-running the Adventure will then transfer normally once a reward is linked.

## Technical notes

- Files touched: `src/hooks/useRewardTransfer.ts`, `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/student/GamePlayPage.tsx`. No database migration needed — `class_gallery_rewards` and `class_gallery_awards` already exist and are simply empty.
- No changes to the Gallery animation, the reward editor, the Progress Bar maths, or the Time Bar controls.
