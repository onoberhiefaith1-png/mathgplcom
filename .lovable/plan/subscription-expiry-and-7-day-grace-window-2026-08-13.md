# Subscription expiry and 7-day grace window

The credit economics pipeline is complete. The remaining piece is what happens when a paid plan reaches the end of its paid period without a renewal: today the subscription simply stops matching the "active" query, so the account silently looks like it never had a plan and credit spending keeps drawing on the leftover wallet.

## What changes for the user

- When a paid plan's period ends without renewal, the account moves to **Expired — renewal required** and enters a **7-day grace window**.
- During grace: all saved work (notebooks, classes, adventures, uploads) stays untouched, but credit spending is paused. Any metered action is blocked with a clear "renewal required" message instead of a vague failure.
- After the 7 days: the account is moved automatically onto the matching **free plan** for its account type. Leftover credits stay in the wallet — the free plan simply adds no more.
- The Plan section on every dashboard (Teacher, School, Family, Student) shows the expired state, a countdown of days left in the grace window, and a **Renew** button that goes straight to the plan gateway.
- Renewing (or a confirmed payment) clears the expired state and restores spending immediately.

## Technical notes

Database (additive migration, no data loss):

- `subscriptions` gains `grace_until timestamptz`.
- New internal helper `public.downgrade_to_free_plan(uuid)` — extracts the existing free-plan fallback logic (service_role only).
- `public.expire_lapsed_subscriptions()` is rewritten to run three passes:
  1. `cancel_at` reached → cancel and fall back to free (existing behaviour, unchanged).
  2. Paid subscription (`final_price > 0`) past `period_end` → `status = 'expired'`, `grace_until = period_end + 7 days`.
  3. `expired` with `grace_until <= now()` → cancel and fall back to free.
- `public.credit_headroom()` gains an `expired` `blocked_reason`, so the existing server-side reservation gates (`reserve_credits`, `consume_credits`, the AI/Cloud meter gates) already block on it without further changes.

Application code:

- `src/lib/plans/plans.server.ts` — `mySubscription` reads `status in ('active','expired')` (newest first) and returns `graceUntil`; `MySubscription` gains `graceUntil: string | null`.
- `src/lib/plans/usePlanGate.ts` — expose `expired` and `graceDaysLeft`; `needsPlan` stays false while an expired subscription exists so nobody is bounced out of their workspace mid-grace.
- `src/components/plans/PlanSection.tsx` — expired banner with grace countdown and Renew action (same pattern as the existing `past_due` banner).
- `supabase/functions/_shared/creditGate.ts` and `src/lib/costs/creditContext.server.ts` — add the customer-facing wording for the `expired` reason.

Also closing a metering gap found while reading: storage uploads for smart-card previews, notebook cover art, game/adventure audio and floating-knowledge documents do not report `storage.gb_month`, unlike course media, avatars and game assets. Those call sites get the same one-line `meterClientUsage` report so every uploaded byte is billed.

## Out of scope

No redesign of dashboards, pricing pages, plan management, or the credit ledger.
