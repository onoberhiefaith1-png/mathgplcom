## Diagnosis (verified)

The reward is rebuilt from scratch when it reaches the Gallery.

- `class_gallery_rewards` stores only `storage_path`, `media_type`, `source`, plus position/scale/rotation/opacity/duration. It does **not** store any of the Adventure element's visual settings.
- `useGalleryAwards.ts` builds the Gallery canvas element with hardcoded `bgRemoval: "none"`, `blend: "normal"`, no `keyColor`, no `tint`, no `slant` — so a chroma/black-screen-keyed reward loses its transparency and the raw uploaded frame (white/checkerboard) shows.
- The Gallery `scale` / `rotation` / `opacity` are applied from frame 0 of the Start → End flight, so the reward also visibly resizes/rotates the instant it enters the Gallery.

The Adventure-side exit animation already uses the live configured element, so the appearance break happens only at the Gallery boundary.

## Fix

**1. Persist the configured instance (additive migration)**

Add a nullable `element_style jsonb` column to `class_gallery_rewards`. It holds a snapshot of the Adventure `CanvasElement`'s visual state: `storagePath`, `mediaType`, `source`, `bgRemoval`, `keyColor`, `keyTolerance`, `blend`, `tint`, `slant`, and the Adventure `scale` / `rotation` / `opacity`. No existing columns or tables change.

**2. Write the snapshot when the placement is saved**

`GameEditorPage.saveReward` already holds `rewardSource`, the full Adventure canvas element. Persist the snapshot from it alongside the existing fields.

**3. Render the instance, not the asset**

`useGalleryAwards.ts` builds each award element from `element_style` when present (falling back to today's behaviour for legacy rows), so transparency keying, blend, tint and slant are preserved end to end.

**4. Apply Gallery settings only at the End Position**

During the Start → End flight the element keeps the Adventure `scale` / `rotation` / `opacity`. On arrival it transitions (short ~350 ms ease) to the Gallery-configured `scale` / `rotation` / `opacity`, which then become its permanent appearance. Legacy rows with no snapshot behave exactly as now.

## Technical notes

- Files: new migration; `src/lib/games/classGalleryRewards.ts` (row type + upsert input); `src/pages/GameEditorPage.tsx` (`saveReward`); `src/hooks/useGalleryAwards.ts` (element construction + arrival tween).
- No change to the Adventure-side exit in `useRewardTransfer.ts` — it already animates the live element.
- No change to `class_gallery_awards`, the win logic, timer freeze, or navigation.
