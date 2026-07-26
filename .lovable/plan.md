## Goal

Connect the already-built systems (Adventure progress bars, Time Bar, Groups, Gallery, reward start/end config) into one runtime workflow. No component is redesigned or rebuilt.

## What already exists (verified)

- Progress bars + live scoring: `useAdventureSync` (supports an optional `barScope` per bar).
- Groups: `adventure_groups` / `adventure_group_members`, `useAdventureGroups` (gives `barOwner`, `studentsByGroup`, `studentGroup`). Teacher dashboard already passes `barScope`; the student play page does not.
- Time Bar: `useGameTimeBar` with `expired`; student play page shows a "Time expired" overlay, assessment board blocks input.
- Gallery: one canvas per class (`class_galleries`), reward start/end/scale/rotation/opacity/duration saved per class+game+reward in `class_gallery_rewards`, preview animation in `GameEditorPage`.
- Missing link: nothing marks a reward as *earned*, nothing plays the transfer at runtime, and galleries have no group dimension.

## Part 1 — Data (additive migration only)

New table `class_gallery_awards`:
- `class_id`, `game_id`, `reward_element_id`, `group_id` (nullable = whole class), `awarded_at`
- unique on (class_id, game_id, reward_element_id, group_id)
- GRANTs + RLS: class members read; class owner and the awarding path write.

`class_gallery_rewards` (the layout/placement) stays untouched — it is the shared layout used by every group's gallery.

## Part 2 — Reward transfer pipeline (runtime)

New hook `useRewardTransfer`:
1. Watches each progress bar's `achieved >= required` (values already computed by `useAdventureSync`).
2. On first completion, and only if the Time Bar has not expired, insert the award row for the winning bar's group (from `barOwner`).
3. Plays the exit animation on the Adventure canvas: reward lifts, fades, and is removed from the rendered element list (it stays removed for that game once awarded).
4. Navigates to the gallery (`/student/class/:classId/gallery` or teacher gallery), passing a `?animateReward=<gameId>:<elementId>` flag.
5. The gallery plays the saved start → end animation over `duration_ms`, then leaves the reward permanently at the end position.

Guard: the award insert is idempotent (unique constraint), so multiple clients completing simultaneously produce one award; the first group to insert is the winner.

## Part 3 — Time Bar lockout

- When `timeBar.expired` and no bar has reached its target: show a **"Time Up"** overlay, freeze the canvas, block opening question boards, and block navigation into the assessment board (the existing assessment-board block is reused).
- No award row is inserted after expiry; every group's gallery is untouched.

## Part 4 — Group-scoped scoring on the student side

- `GamePlayPage` and `StudentGameLivePage` gain `useAdventureGroups` and pass the same `barScope` map the teacher dashboard already builds, so a student's marks only raise their own group's bar.
- A student can only open the board of the bar owned by their group (other bars remain view-only).

## Part 5 — Gallery: one layout, per-group data

- `ClassGalleryEditorPage` (teacher): group tabs across the top (Whole Class + each group). Tabs only change which award rows are rendered — canvas, background, layout and reward end positions come from the single shared gallery record.
- `StudentGalleryPage`: resolves the student's group automatically via `studentGroup` and renders that group's awards only. No group picker.
- Both render: base gallery elements + awarded rewards drawn at their saved end position/scale/rotation/opacity.

## Technical notes

- Files touched: `src/pages/student/GamePlayPage.tsx`, `src/pages/student/StudentGameLivePage.tsx`, `src/pages/student/StudentGalleryPage.tsx`, `src/pages/GameEditorPage.tsx` (gallery mode: tabs + award rendering + arrival animation), `src/lib/games/classGalleryRewards.ts` (award read/write helpers), plus new `src/hooks/useRewardTransfer.ts`.
- No changes to the reward config panel, Time Bar controls, Groups panel, progress bar rendering, or Smartboard.
