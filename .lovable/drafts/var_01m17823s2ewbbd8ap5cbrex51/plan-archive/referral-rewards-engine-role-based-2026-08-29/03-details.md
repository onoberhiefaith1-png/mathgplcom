## Data model (staged migration, applied when this draft is accepted)

- `referral_campaigns` — `id`, `owner_kind` (`platform` | `school` | `teacher`),
  `owner_user_id`, `org_id`, `name`, `reward_type` (text: `payment`/`discount`/`other`),
  `reward_rule` (jsonb: currency, amount, discount_kind, description),
  `trigger` (`registration` | `subscription`), `is_active`, timestamps.
  Reward type as text + jsonb rule is the extension point for future types.
- `referral_links` — `id`, `campaign_id`, `referrer_user_id`, `org_id`, `code` (unique,
  short), `is_active`. One link per referrer per campaign; the code identifies the referrer.
- `referral_events` — click/registration/subscription audit trail with `code`, `referred_user_id`.
- `referral_attributions` — `referred_user_id` (unique), `link_id`, `registered_at`,
  `subscribed_at`, `referred_role`.
- `referral_rewards` — `attribution_id`, `campaign_id`, `referrer_user_id`,
  `reward_type`, `currency`, `amount`, `status` (`pending` | `eligible` | `paid`),
  `qualified_at`, `paid_at`, `paid_note`.
- GRANTs on every new table (`authenticated`, `service_role`; `anon` only for the
  click-recording path, handled through a server function instead of direct anon access).
  RLS: referrers read their own rows; school administrators read rows for their org via
  `is_org_owner`; platform administrators read all via `has_role(auth.uid(),'platform_owner')`.
  Only administrators may set `status = 'paid'`.

## Server side

- `src/lib/referrals/referrals.functions.ts`
  - `recordReferralClick` (public, code only — stores a cookie/localStorage marker
    and an event row; no PII).
  - `myReferralOverview`, `myReferralActivity`, `myReferralRewards` (auth, scoped to caller).
  - `schoolReferralOverview`, `platformReferralOverview` (auth + role check).
  - `saveReferralCampaign`, `setCampaignActive`, `markRewardPaid` (role-checked).
  - `ensureMyReferralLink` — creates the caller's link/code on first visit.
- Attribution on registration: the referral code captured from `?ref=` is passed through
  signup metadata in `RoleAuthPage.tsx` and turned into an attribution row (+ reward row
  in `pending`/`eligible` per the campaign trigger) by a server function called on first
  authenticated load.
- Subscription conversion: the existing subscription-activation path also settles any
  pending referral reward for that user, flipping `pending → eligible` when the campaign
  trigger is `subscription`.
- All money maths server-side, grouped by currency; nothing is summed across currencies.

## UI

- `src/pages/referrals/ReferralDashboard.tsx` — shared shell, role-aware sections:
  Overview cards → referral link (copy / share) → activity table (Referral, Role,
  Registered, Subscribed, Reward status, Reward, Date; no email or personal detail) →
  Rewards → Performance/conversion.
- `src/pages/referrals/CampaignEditor.tsx` — dropdown-driven configuration
  (reward type → conditional fields → currency → trigger → active), with a live preview
  line such as “£5 × 5 eligible = £25”.
- Platform view adds filters (all / teachers / schools / students / parents / registered /
  subscribed / pending / completed) and Top referrers; school view is scoped to its org;
  teacher view is personal.
- Routes: `/referral`, `/referral/campaigns` (administrator and school administrator only,
  gated by role, listed in navigation only for the three permitted roles).
- Rewards card added to the teacher and school dashboards using the existing
  `SectionCard` / `StatCard` components and the `rewards` section theme — no new colours.

## Notes

- Referral stays inside the private role dashboards; nothing is added to Community and
  Teaching Hub is left as-is.
- Because this is a draft, the new tables exist only after the draft is accepted; the
  dashboards can be reviewed for real once it is.
