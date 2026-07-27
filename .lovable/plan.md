## What I verified

- `class_gallery_rewards` is empty project-wide, but the class in question (`fd91cf45…`) **does** have a Class Gallery row in `class_galleries`. So the real state is "Gallery exists, reward not yet linked to it" — not "no reward in the Adventure".
- `useRewardTransfer` only ever loads `class_gallery_rewards` + `class_gallery_awards`; it never checks whether the class has a Gallery, and its `no_reward` message wrongly phrases the miss as an Adventure-level link.
- Reward assets are already self-identifying: every canvas element carries `kind: "reward"` (`AssetKind = background | reward | progress_bar | effect`), so nothing needs to ask the teacher what a reward is.
- The Gallery reward placement editor already exists and is reached at `/teaching-hub/classes/:classId/gallery?configureReward=<gameId>:<elementId>`, saving Start/End/scale/rotation/opacity/duration into `class_gallery_rewards`.

## Plan

**1. Make the Gallery the subject of the lookup**
In `useRewardTransfer`, load three things for the class: the Gallery row, the reward placements for this game, and the awards. Replace `blockedReason` values with:
- `no_gallery` — the class has no Gallery row.
- `not_linked` — Gallery exists, but this reward has no placement row.
- `already_awarded`, `time_expired` — unchanged.
The hook stops treating "no placement" as "no reward in the Adventure".

**2. Detect rewards automatically from the Adventure canvas**
Pass the Adventure's reward elements (`kind === "reward"`) into the hook. They are the candidate rewards; the hook matches each against the Gallery placements by element id. No teacher input, no re-identification.

**3. Correct the on-screen messages**
Teacher dashboard and student page show exactly:
- no Gallery: "This class does not have a Gallery yet. Please create a Class Gallery before rewards can be transferred." with a button to open the class Gallery.
- not linked: "This reward has not yet been linked to this Class Gallery. Please link the reward to the Class Gallery and configure its Start Position and End Position." with one "Link <reward> to Class Gallery" button per unlinked reward element, opening the existing `?configureReward=` editor.
The string "no reward is linked to this Adventure" is removed everywhere.

**4. Keep the transfer itself unchanged, and make removal permanent**
When a bar reaches its goal: freeze + pause timer (already in place), lift the reward out at the saved `duration_ms`, write the `class_gallery_awards` row, then navigate to *this class's* Gallery with `?animateReward=` so the saved Start → End path plays. Reward elements whose id appears in this class+game's awards are filtered out of the Adventure scene on every load — for both teacher and student — so a completed Adventure never shows the reward again.

**5. Re-arm correctly**
Fire the transfer as soon as the goal is met *and* a linked placement exists, including when the link is added after the goal was already reached.

## Technical notes

- Files: `src/hooks/useRewardTransfer.ts` (Gallery lookup, new `blockedReason` values, reward-element input), `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/student/GamePlayPage.tsx` (messages + link buttons + unconditional award filtering).
- New read helper for `class_galleries` by class id (read-only; does not create a Gallery as a side effect).
- No database migration: `class_galleries`, `class_gallery_rewards` and `class_gallery_awards` already model Class → Gallery → Placement → Award.
- The Gallery animation code, the reward placement editor, the Progress Bar maths and the Time Bar controls are untouched.
- Existing Part 7 behaviour stays: if the timer expired before the goal, no transfer — now stated plainly rather than looking broken.
