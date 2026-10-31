# Academia / Mathemagine — Per-tier Level Bar Implementation

**Status:** Implemented and landed on GitHub `main`.  
**Repo:** MathGPL / LevelUp (`mathgplcom-fix`).  
**Implements:** Next-edition items from `ACADEMIA_NEXT_EDITION_SPEC.md` (§1–§5 and Mathemagine parity for Level bar + per-tier videos).  
**Commit:** `0cd3cfffab08434b1dffd656c05714743eb883c1` (`0cd3cff`)  
**Date:** 2026-10-31 (UTC) — author date 2026-10-31 15:15:25 +0000  
**Commit message:** Academia/Mathemagine: per-tier Level bar, videos, and one-tier session view

---

## What changed

### Per-tier Level bar
- Session view uses a single **Level** control (Beginner / Intermediate / Expert) with ◀ ▶ (`TierSwitcher`).
- Switching Level updates **video and activities together** for the active tier.
- Empty tier shows that tier’s empty state; no cross-tier video fallback.

### Videos (one slot per tier)
- Session rows gain Beginner / Intermediate / Expert theory video fields (`video_url`, `intermediate_video_url`, `expert_video_url`) via migration `0023` and the matching Supabase migration.
- Helpers in `src/lib/academia/tiers.ts` (`sessionTierVideoUrl`) pick the URL for the active tier.
- **Academia (web):** Level bar above video; laptop shows three `TierVideoCard`s side by side; phone shows the active tier’s video only.
- **Mathemagine:** one active-tier video at a time; Level ◀ ▶ swaps video + activity batch.

### One-tier session view (Mathemagine)
- Mathemagine session UI presents a **single** active-tier stack (not three full stacks as the primary view).
- Opens on the learner’s **default tier** (or Beginner if unset).

### Also in the same commit
- Default-tier preference (`useDefaultTier`, Learning Preferences / settings).
- Floating Number Size controls and thumb-friendly practice targets (`PRACTICE_THUMB_BUTTON`).
- Offline pack / academia-pack wiring for per-tier videos.

---

## Key paths

| Area | Paths |
|------|--------|
| Level bar | `src/components/academia/TierSwitcher.tsx`, `AcademiaSessionPage.tsx`, `AcademiaApp.tsx` |
| Tier videos | `src/lib/academia/tiers.ts`, `drizzle/migrations/0023_academia_tier_videos.sql`, academia-pack route |
| Defaults / size | `src/hooks/useDefaultTier.ts`, `LearningPreferences.tsx`, floating-number size modules |

---

## Note for Lovable

This markdown file documents the implementation commit so it is visible in the Lovable project file tree after GitHub sync. The live site still needs Lovable to sync (and publish) past this commit for the UI to appear on mathgpl.com.
