# Plan Management, Subscriptions & Credit Allocation

A real, database-backed plan engine added to the existing Platform Owner console. Nothing existing is redesigned or removed: Security, Email, Billing & Costs, Cost Analytics, Usage Analytics and Usage & Revenue keep working exactly as they do, and the accounting ledger stays credits-first.

## Verified starting point

- `plans` already exists with 7 rows (Teacher Free/Pro/Super Pro, School Pro, Parent Free/Pro, School Super Pro) as a plain "subscription amount + credit amount" split — no versioning, no draft/publish, no features, no subscriber counts.
- `subscriptions` already carries the lock columns (`plan_id`, `locked_profit_rate`, `credit_price`, `credit_sell_price`, `included_credits`, `pricing_version_id`, `currency`, `region`, `discount_percentage`, `final_price`, period start/end) and has 0 rows.
- `currency_rates` holds GBP at cost £0.31, profit 50%, `follows_base` — the pricing engine and `resolve_credit_pricing` are live.
- `credit_wallets` / `credit_ledger` exist per cost unit; `plans` has no plan-version table and no payment/Stripe tables.
- Admin routes today: `/admin`, `/admin/security`, `/admin/email`, `/admin/billing`, `/admin/cost-analytics`, `/admin/cost-revenue`, `/admin/usage-analytics`. There is no plan-selection step in the signup flow and no payment provider connected.

## 1. Plans entry point

A **Plan Management** tile joins the existing console tiles on `/admin`, opening a new `/admin/plans` page in the same dark navy / gold-accent style.

## 2. Plan Dashboard (admin)

Sections on `/admin/plans`:

- **Plan overview cards** per audience (Student, Teacher, Parent, School, Super Pro): plans, current price, derived included credits, current profit %, active subscribers, free vs paid users, last updated. Student shows "Free — no subscription". Super Pro shows only "Coming Soon".
- **Plan editor with draft → publish**: name, monthly price, platform-fee component, credit-budget component, currency, active/availability, free/paid, description, feature list. Editing writes a draft; a side-by-side preview shows Current vs New (e.g. 50% → 10.75 credits vs 20% → 13.44 credits) with **Save draft** and **Publish changes**. Only publishing creates a new live version.
- **Live calculator**: platform fee + credit budget, cost per credit, profit %, derived sell price and included credits, total price — recalculating as fields change.
- **Version history** per plan: version number, date, published by, price, profit %, credit allocation, currency, status. Insert-only; nothing is ever deleted.
- **Currency & regional pricing**: GBP as base; per-currency exchange rate, credit cost, profit %, sell price, and a **Follow base currency** toggle (on = follows GBP, off = manual and untouched by GBP changes; switching back adopts current GBP).
- **Global profit percentage** control with free numeric entry, feeding all currencies that follow base.
- **Plan analytics**: active subscriptions, free/paid users, revenue and expected revenue, credits allocated / consumed / remaining, estimated cost and profit, expiring subscriptions, failed payments, cancellations, upgrades, new subscriptions — filterable by audience, plan, currency, region and date.

## 3. Plan structure and prices

Prices are defaults held in the database, editable at any time — never hard-coded:

```text
Student   Free      no plan screen, no checkout
Teacher   Free  £0  | Pro £9.99 = £4.99 platform + £5.00 credit budget | Super Pro coming soon
Parent    Free  £0  | Pro (admin-set: £4.99 = £2.99 + £2.00 to start)
School    Pro £40.99 = £15.99 platform + £25.00 credit budget | Super Pro coming soon
```

Included credits are always derived: `credit budget ÷ (cost per credit × (1 + profit%))`. Parent Free connects through schools only; attempting a direct teacher connection shows the upgrade message.

## 4. Subscription version locking

Subscribing snapshots plan version, price, currency, profit %, credit cost, credit sell price, included credits and period onto the subscription row. A later admin change affects new subscriptions and renewals only — a 12 August subscriber stays on v1 / 50% / 10.75 credits while a 13 August subscriber gets v2 / 20% / 13.44 credits.

## 5. Signup, plan selection and upgrades

- Register → choose account type → verify email → plan step **only** where required: Teacher (Free / Pro / Super Pro disabled), Parent (Free / Pro), School (Pro). Students skip straight into the platform.
- Selection happens once. Afterwards login goes straight to the dashboard; the account panel gains a **Plan** section (current plan, status, renewal date, included credits, credits remaining, price, "pricing locked until renewal") and an **Upgrade plan** button showing only higher plans.
- Plan changes are scheduled: current plan stays active until the transition point, with Current plan / Next plan both shown.

## 6. Payments

Paid checkout uses Lovable's built-in Stripe payments, enabled as the final step (test environment first). Stripe handles checkout, recurring billing, failures, cancellation, renewal and expiry, and reports back as payment events. It never controls the credit economy: on confirmed payment the system records the payment, creates the subscription with its locked version, derives included credits and credits the user's MathGPL wallet. Credits are never allocated before confirmation. Free plans create no Stripe records but their usage still meters as real cost/exposure.

## 7. User-facing pricing page

A public pricing page reading live published plans: Teacher Free/Pro, School Pro, Parent Free/Pro, Student Free, Super Pro "Coming Soon". Price and credit-allocation changes appear automatically for new users. Internal cost and profit figures are never exposed.

## Technical section

Additive migrations only, each new public table with GRANTs then RLS (platform-owner select via `has_role`, service_role write; public read only for published plan versions):

- `plan_versions` (plan_id, version_no, price, platform_amount, credit_amount, currency, profit_percentage, credit_cost, credit_sell_price, included_credits, status draft/published/archived, published_by, published_at) — insert-only history; `plans` gains `description`, `is_free`, `audience_visible`, `current_version_id`.
- `plan_features` (plan_id, label, sort_order).
- `regional_pricing` handled by extending `currency_rates` (already has `profit_percentage`, `follows_base`) with `exchange_rate`; global percentage keeps writing `pricing_versions`.
- `stripe_customers`, `payment_transactions` (provider, provider_ref, amount, currency, status, subscription_id); `subscriptions` gains `plan_version_id`, `scheduled_plan_id`, `cancel_at`, `stripe_subscription_id`.
- SQL: `publish_plan_version(plan_id)` snapshots current pricing into a new version; `activate_subscription(...)` writes the locked snapshot, credits the wallet via `credit_ledger`, and records the payment row. `record_usage_event` is untouched.
- Server: extend `src/lib/costs/costAdmin.server.ts` for version/feature/regional writes; new `src/lib/plans/plans.server.ts` + `plans.functions.ts` for public plan reads, derived credits (reusing `src/lib/costs/pricing.ts`), subscription creation and upgrade scheduling; admin writes stay behind `assertPlatformAdmin`.
- UI: `src/pages/admin/PlanDashboard.tsx` + route `src/routes/admin/plans/index.tsx`, panels under `src/components/admin/` (PlanOverview, PlanEditor with draft/publish diff, PlanCalculator, PlanVersionHistory, RegionalPricing, PlanAnalytics); `src/components/plans/PlanSelection.tsx` for signup; plan + upgrade block in `MyAccountPage.tsx`; public `/pricing` route.
