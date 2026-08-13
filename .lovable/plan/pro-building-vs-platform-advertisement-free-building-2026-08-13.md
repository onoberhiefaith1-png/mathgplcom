# Pro Building vs Platform Advertisement (Free) Building

Two building configurations driven by one renderer. The Pro building stays exactly as it is today (per-account, fully customizable). The Free building becomes a platform-owned advertisement building that only the platform owner can edit, seeded as an exact copy of the current Pro configuration.

```text
CONTEXT
  ├── Pro / School workspace → personal Pro building   → no ads
  ├── Free teacher / parent   → platform Free building → 8 ad slots
  ├── Student workspace       → building, no ads
  └── Community               → platform Free building → 8 ad slots
```

## 1. Building versions

- **Pro building** — unchanged: `profiles.homepage_config` per account, edited from the existing Settings gear (Change Background, Edit MathGPL Building, Replace Building).
- **Free building** — one platform-level record, editable only by the platform owner. On first open it is created by copying the acting owner's current Pro configuration (background, all 16 slot overrides, custom building, animation/transform values) so it starts visually identical, then diverges independently.

Writes are separated by construction: Pro writes go to the profile row, Free writes go to the platform row. No shared mutable object.

## 2. Admin building customization

The existing three pages get a **BUILDING VERSION** selector at the top:

```text
BUILDING VERSION   [ PRO ]   [ FREE PLAN ]
-----------------------------------------
Change Background — Pro Plan / Free Plan
Edit MathGPL Building
Replace Building
```

- The selector appears only for the platform owner. Everyone else sees the Pro pages exactly as today, with no selector and no route to the Free building.
- Titles state which version is being edited; all three actions operate on the selected version only.
- All 16 artwork slots exist for both versions and are independently replaceable/revertable.

## 3. Advertisement slots (platform owner only)

New admin page **Advertisements** (`/admin/advertisements`), reachable from the platform console:

- 8 slots, each: upload image or video, preview, replace, remove, active toggle, image display duration.
- Slots map to the 8 outer ring positions; the inner core slots are never ad slots.
- Empty slots are skipped — the rotation cycles through whatever 1–8 ads are active.
- Preview shows the ad inside the billboard on the real rotating building, plus a play control for video.
- Permission is exactly `role === platform_owner`. Owning a building never grants ad access.

## 4. Billboard behaviour on the rotating building

A billboard surface is added to the building renderer, shown only when the rendered configuration is the ad-enabled Free/Community configuration:

- **Image ad** — appears when its ring position faces the camera, holds for its duration, rotation continues normally.
- **Video ad** — when its position faces the camera the rotation pauses, the video plays to the end, then rotation resumes to the next ad.
- Content is clipped to the billboard, aspect-ratio preserved, never overflowing the building or the inner artwork.
- With no active ads the billboard is not rendered and rotation is exactly as today.

## 5. Context → building → ads pipeline

One resolver decides what to render:

| Context | Building | Ads |
| --- | --- | --- |
| Pro teacher/parent personal workspace | own Pro config | no |
| Free teacher/parent personal workspace | platform Free config (read-only) | yes |
| School workspace (owner or member) | school/Pro config | no |
| Student workspace | school/teacher config | no |
| Community | platform Free config | yes |

Plan state comes from the existing plan/access system (`usePlanGate` / active subscription + active workspace), not from role strings alone: a free teacher working inside a paid school workspace resolves to the school experience with no ads.

For Free users the Settings gear is hidden entirely — no Change Background, no Edit Building, no Replace Building, no ad controls.

## 6. Ads nowhere else

Ads render only inside the building renderer's billboard. No global ad component, no banners, no pop-ups, and nothing in Lesson Notes, Smartboard, Assignments, Adventure, Assessment, Reports, dashboards, account pages or settings.

## Technical notes

- Migration (additive): extend the existing `platform_building_default` singleton with a `free_building jsonb` column holding the same `HomepageConfig` shape, plus a new `platform_advertisements` table (slot 1–8, media path/source/media_type, active, duration_ms, sort order, timestamps) with GRANTs, RLS, owner-only write policies and public/authenticated SELECT of active rows only. Extend `set_platform_building_default` or add a companion security-definer setter that checks `has_role(auth.uid(),'platform_owner')`.
- `src/lib/homepage/homepageConfig.ts` gains a `"platform-free"` mode (read platform row; write only for the owner) plus a seed-from-Pro helper. The existing `"self"` and `"school-readonly"` modes are untouched.
- New `src/lib/homepage/useBuildingContext.ts` returns `{ configMode, adsEnabled, canCustomize }` from role + workspace + plan gate; `Index.tsx`, `CommunityHome.tsx`, `SchoolMemberWorkspacePage.tsx` and `HomepageSettingsButton.tsx` consume it instead of hardcoding `configMode`.
- `RotatingAdventureScene.tsx` keeps its geometry constants, ring/core textures and rotation code; it gains an optional billboard child and an `adsEnabled` prop that drives rotation pause/resume for video ads. No second building engine.
- The three `src/pages/homepage/*` pages take a `?version=pro|free` search param, gated to the platform owner, and pass the matching config mode into the existing upload/preview/apply flow.
- Ad media reuses `uploadGameAsset` / `game_assets` and `SignedMedia`; no new bucket.
- Responsiveness is inherited because both versions use the same renderer.
