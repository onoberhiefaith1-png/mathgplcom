# Administrator Referral Console

Give the platform administrator a dedicated Referrals area inside the Platform console, where every referral offer is created, edited and targeted. Nothing is offered to anyone until the administrator sets it.

## What changes for you

1. **New button in the Platform console** — next to Security, Advertisements, Website, Access Codes, Plans: **Referrals** (`/admin/referrals`).
2. **Referral offers are fully editable** — name, reward type (payment / discount / other reward), currency, amount or percentage, wording of the reward, and when it becomes eligible (on registration or on subscription).
3. **You choose who receives each offer** — audience selection: Teachers, Schools, Parents, Students (any combination), or a specific named account. Only the assigned audience sees the offer and gets a referral link on their dashboard.
4. **Draft → Live** — every offer starts as a Draft and is invisible platform-wide until you publish it. You can pause, edit or retire it at any time; editing a live offer never changes rewards already earned.
5. **No pre-set £5** — the seeded £5 platform offer is removed. Until you create and publish one, dashboards show "No referral programme is running yet" and no amount is displayed anywhere.
6. **Schools and teachers keep their own** — a school or teacher still sees your platform offer (if their role is in its audience) and can additionally create their own offer so people can be referred to them. Their own offer never overrides yours; both links work side by side.
7. **Administrator overview** — for each offer: assigned audience, people referred, registered, subscribed, rewards pending and rewards settled, plus top referrers, and the ability to mark a reward as paid.
8. **Guided page** — the page carries a page guide entry so the workflow is explained in place, matching the other admin consoles.

## Technical notes

- Migration on `public.referral_campaigns`: add `audience text[] NOT NULL DEFAULT '{}'` (values from the app roles), `status text CHECK (status IN ('draft','live','paused','retired')) DEFAULT 'draft'`, and `target_user_id uuid` for single-account assignment. Backfill existing rows to `status = 'draft'`, and deactivate/remove the seeded £5 platform row.
- RLS unchanged in shape: owners manage their own campaigns, administrators (`referral_is_admin()`) manage all; readers only see `status = 'live'` campaigns whose audience includes their role (or that target them directly).
- `referrals.server.ts`: `campaignFor()` gains audience + status filtering (role read from `user_roles`), so a user with no matching live campaign returns `campaign: null` and `ensureLink` creates nothing. `dashboard()` gains an admin branch listing all campaigns with per-campaign counts.
- New server fns in `referrals.functions.ts` (all `requireSupabaseAuth`, admin ones call `assertAdmin`): `listAdminReferralCampaigns`, `setReferralCampaignStatus`, `deleteReferralCampaign`; `saveReferralCampaign` input extended with `audience`, `status`, `targetUserId`.
- New page `src/pages/admin/ReferralAdminPage.tsx` + route `src/routes/admin/referrals/index.tsx` (own `head()` metadata, `noindex`), built on `DashboardShell` and the existing dash tokens; `CampaignDialog.tsx` extended with audience checkboxes, account picker and status control (reused by school/teacher scopes without the audience field).
- `ReferralDashboard.tsx` / `ReferEarnCard.tsx`: render an explicit empty state when `campaign === null` instead of any default figure.
- Verify: typecheck, referral unit tests for audience/status filtering and the null-campaign path, and route load checks for `/admin/referrals`.
