# Plan Access as the Single Source of Truth + Locked Snapshots + Yearly Billing

Today the plan builder has two disconnected lists: the typed "What this plan includes (one per line)" bullets (`plan_features`) shown on the gateway, and the real Plan Access switches (`plan_entitlements`) the application enforces. Access is also resolved from the plan's *current* configuration (`account_plan_id` → `plan_entitlements`), so editing a plan changes existing subscribers immediately. There is no yearly billing anywhere (`priceKeyForPlan` mints only `<plan>_monthly`), and there is no "Teacher Payments" feature key.

This change closes those gaps without touching the credit/accounting architecture.

## 1. Remove the manual description list

- Delete the "What this plan includes (one per line)" field from the admin plan editor and stop writing `plan_features`.
- The customer-facing feature list is generated from the plan's enabled Plan Access switches, using each feature's catalogue label, grouped in catalogue order.
- Only enabled features are listed. Nothing is ever shown as "not included".
- Limits become generated lines too: `max_classes = 1` reads "1 class", blank reads "Unlimited classes"; same for students.
- `plan_features` rows stay in the database untouched but are no longer read or written, so nothing existing breaks.

## 2 & 3. One switch = one permission = one capability

- Every switch is already a `feature_entitlements.key`; the plan editor, the gateway, the client gate (`useEntitlements` / `RequireEntitlement`) and the server check (`requireEntitlement` → `has_entitlement`) all use that one key.
- Audit pass over the feature list so each key has a real enforcement point: every AI/lesson-note/assignment/adventure/report/live/export/credit server path calls `requireEntitlement` before doing work and returns the structured `entitlement_required` error the UI renders as the upgrade message. Any key with no enforcement point gets one; nothing is left as "hidden button only".
- Upgrade copy is tightened so the message names the plan that grants it, e.g. "You need to upgrade to Teacher Pro to use AI Lesson Note Generation." The target plan name is resolved from the plans that currently enable that feature for the account's audience, so the wording follows the configuration instead of being hard-coded.

## 4 & 5. Locked subscription snapshot

New table `subscription_entitlements` (a snapshot, not a second catalogue):

```text
PLAN CONFIGURATION → PLAN VERSION → SUBSCRIPTION → LOCKED SNAPSHOT → ENTITLEMENTS → FEATURE ACCESS
```

- On activation (free start, confirmed payment, renewal, plan change), the subscription stores a snapshot row set: the enabled feature keys, the limit values, plus the commercial terms already captured on `subscriptions` (`final_price`, `included_credits`, `credit_price`, `credit_sell_price`, `locked_profit_rate`, `plan_version_id`).
- `effective_entitlements` and `effective_limit` are rewritten to read the **snapshot** of the account's live subscription first, falling back to the plan's current configuration only when no snapshot exists (free/unsubscribed accounts, and every account that predates this change — a one-off backfill mints snapshots for current active subscriptions from their locked plan version).
- Result: changing Teacher Pro from 10 students to 5 leaves existing subscribers on 10 until their period ends; renewals and new subscriptions snapshot the new version.
- Connection-inherited entitlements (`via_school` / `via_teacher`) resolve from the *other* account's snapshot by the same rule, so a school's locked terms flow to its teachers.
- The admin plan editor gains a plain note: "Changes apply to new subscriptions and renewals. Existing subscribers keep the terms they bought."

## 6. Teacher Payments

- New catalogue feature `teacher_payments` ("Teacher Payments"), category Teaching, applies to `teacher` and `school`, enabled on the Pro plans and off on Free by seed.
- The existing teacher/school payment-receiving surface (Pricing workspace, Stripe Connect onboarding, gateway activation) is gated on this key: client gate for the UI, `requireEntitlement` on the onboarding/activation/payout server paths.
- Teacher Free sees the upgrade message pointing at Teacher Pro instead of a dead button.

## 7, 8 & 9. Yearly subscription at 20% off

- Yearly price is always derived, never typed: `yearly = round(monthly × 12 × 0.8)`. £10/month → £120 standard → £24 discount → £96 charged.
- `plans`/`plan_versions` gain a `yearly_enabled` flag (default on for paid plans); the admin editor shows the computed yearly figure read-only next to the monthly price.
- The provider catalogue gains a second price per paid plan, `<plan>_yearly`, kept in sync by the same `catalogSync` comparison that already guards the monthly amount, so checkout can never charge an amount that disagrees with the published plan.
- The gateway shows a Monthly / Yearly toggle on paid cards with "Yearly — 20% discount", the exact annual amount charged, and the monthly equivalent as a hint. Yearly is one annual payment; the customer payment is never split.
- The subscription snapshot records `billing_interval`, `monthly_equivalent`, `standard_annual_price`, `discount_percentage` and the paid amount, and the period runs 365 days. A later monthly price change does not touch that £96 until renewal.

## 10. Gateway

The gateway (and the public pricing page, so the advertised list cannot drift) renders the generated feature list from the plan's enabled Plan Access permissions with a tick per feature — automatically reflecting whatever the administrator publishes next.

## 11. Accounting untouched

Credits, wallets, grants, lots, FIFO consumption, pricing versions and the ledger are unchanged. The snapshot simply *records* the credit terms in force at purchase alongside the feature terms; credit allocation still runs through the existing `activate_subscription` / grant path, and yearly purchases allocate the plan's credits on the existing monthly cadence rather than inventing a new credit mechanism.

## Technical notes

- Migrations (additive, with GRANTs and RLS: owner reads own snapshot, service role writes): `subscription_entitlements`, `subscription_terms` columns on `subscriptions` (`billing_interval`, `monthly_equivalent`, `standard_annual_price`, `discount_percentage`), `yearly_enabled` on plans/versions, seed for `teacher_payments`, snapshot-writing inside `activate_subscription`, rewritten `effective_entitlements` / `effective_limit`, backfill for existing active subscriptions.
- Code: `src/lib/entitlements/features.ts` (new key + plan-aware upgrade copy), `entitlements.server.ts` (snapshot-aware reads, generated feature lists), `src/lib/plans/plans.server.ts` (drop `savePlanFeatures` from the flow, expose generated features + yearly figures), `src/pages/admin/PlanDashboard.tsx` (remove the text field, add yearly display and the locking note), `src/pages/plans/PlanGatewayPage.tsx` and `PublicPricingPage.tsx` (generated lists, monthly/yearly toggle), `src/lib/paddle.ts` (`priceKeyForPlan(planKey, interval)`), `src/lib/payments/catalogSync.server.ts` (yearly price rows), plus `requireEntitlement` calls on the payment-receiving and any unguarded feature paths.
- Rollout order: migration + seed + backfill → snapshot-aware resolver → generated feature lists (admin + gateway) → yearly pricing and checkout → Teacher Payments gating → enforcement audit.
