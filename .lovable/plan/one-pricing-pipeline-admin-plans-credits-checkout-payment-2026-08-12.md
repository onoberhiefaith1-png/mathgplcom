# One Pricing Pipeline: Admin Plans → Credits → Checkout → Payment

Everything customers can buy will be derived from the Plans section in the admin dashboard. No prices will be typed into payment code or into the payments test screen.

## What is true today (verified)

- Admin pricing is already the source of truth in the database: credit cost £0.31, profit 50%, so a credit sells for £0.465. Plan versions store the money split and derive included credits from it (Teacher Pro £9.99 → 10.75 credits, Parent Pro £4.99 → 4.30, School Pro £49.99 → 64.52).
- Subscription price locking already works: each subscription keeps the plan version and profit rate it was bought at.
- The payment provider, however, holds **fixed copies** of these amounts, created once by hand: `teacher_pro_monthly`, `parent_pro_monthly`, `school_pro_monthly`, plus two hard-coded credit packs `credits_20` (£9.30) and `credits_50` (£23.25). Changing the credit cost or profit in admin does not move them — that is the mismatch in the screenshot.
- Pay-as-you-go is not wired up at all: there is no "buy credits" screen, and the database routine that adds bought credits is never called by anything.
- Credits never expire today — the wallet holds a single balance with no expiry date, so the 1-year rule does not exist yet.
- There is no cancel, no billing portal, and no way to switch an existing paid plan (a second purchase would open a second subscription and bill twice).

## What will be built

### 1. Admin pricing drives the provider catalogue

- One place computes the sell price: credit cost × (1 + profit %). Plan prices and pay-as-you-go pack prices both come from it.
- When an administrator publishes a plan version or changes the cost/profit, the matching provider price is rewritten to the new amount automatically. Publishing therefore updates test and live pricing in one action.
- A "Pricing pipeline" panel in the admin Plans screen shows, for each plan and credit pack: admin amount, provider amount, and whether they agree — with a "Sync to payments" button and a warning row when anything drifts.

### 2. Pay-as-you-go credits, derived not typed

- Credit packs become database rows (credits + label + sort), not hard-coded prices: 20, 50, 100, 250 credits to start.
- Each pack's money price is always `credits × current sell price` — never stored as a fixed number in code.
- A "Buy credits" section on `/plans` shows each pack's credit amount, its price, and the per-credit rate, and opens checkout for it.
- The two existing packs are kept and repriced by the sync step, so no duplicate items appear.

### 3. Credits expire one year after they arrive

- Credits are recorded in dated batches (plan allowance and purchases alike) with a 1-year expiry, and the spendable balance only counts unexpired batches. Spending consumes the oldest batch first, so purchased credits are used before they lapse.
- The wallet display on `/plans` shows the balance plus the next expiry date and amount.
- Expired batches are swept nightly and shown in the credit history as expired, not lost silently.

### 4. Purchases actually land, exactly once

- Credit purchases are recognised from the payment event and added through the existing top-up routine, keyed on the payment reference so provider retries can never double-credit.
- Every incoming payment event is logged first and skipped if already handled, which also fixes duplicate plan activations and duplicate credit allowances on retries.

### 5. Managing an existing subscription

- On `/plans`, a paying customer gets: **Change plan**, **Cancel plan**, and **Update payment details**.
- Changing plan modifies the existing subscription with the provider instead of opening a second one — upgrades apply immediately at the current price, downgrades apply at renewal.
- Cancelling keeps access until the paid period ends; when the date passes the account drops to the matching free plan and keeps any credits still inside their 1-year window.
- Switching to a free plan cancels the paid subscription with the provider so billing stops.

## How to test in the preview

1. Open `/plans` while signed in. The preview always runs in test mode, so no real money moves.
2. Buy Teacher Pro. Card `4242 4242 4242 4242`, any future expiry, CVC `123`, any name.
3. Confirm the plan card flips to active, the included credits appear in the wallet, and the expiry date is roughly a year out.
4. Buy a credit pack and confirm the balance increases by exactly the pack's credits, once — even if the provider retries.
5. In admin → Plans, change the profit percentage, publish, and confirm both the plan price and every credit pack price move together, and that your already-active subscription keeps its old price.
6. Use **Change plan** to move to School Pro and confirm no second subscription is created; then **Cancel** and confirm access is retained until the period end date shown on the card.
7. To test a failed renewal, use card `4000 0027 6000 3184` — features stay open but chargeable credit spending pauses.

## Technical notes

- New tables: `credit_packages` (credits, label, active, sort) and `credit_grants` (wallet, credits, remaining, source, granted_at, expires_at). `adjust_credits` and `can_afford_usage` are rewritten to read and consume grants FIFO with `expires_at > now()`; a nightly `expire_credit_grants()` handles lapses.
- `src/lib/pricing/sellPrice.ts` becomes the single derivation used by admin, plans and checkout; `src/lib/costs/pricing.ts` re-exports it so existing callers keep working.
- New `src/lib/payments/catalogSync.server.ts` pushes plan-version and pack amounts to the provider through the existing gateway helper in `src/lib/paddle.server.ts`; called from `publishPlan`, from cost/profit saves, and from an admin-only `syncPaymentCatalog` server function.
- `src/routes/api/public/payments/webhook.ts`: log-then-skip against `payment_events`, `transaction.completed` branch resolving `credits_*` external ids to a package and calling `paddle_record_topup`, plus subscription-change and cancellation branches.
- New server functions in `src/lib/plans/plans.functions.ts`: `openTopupCheckout`, `changePaidPlan`, `cancelSubscription`, `openBillingPortal` (provider customer portal session from `provider_customer_id`).
- `expire_lapsed_subscriptions()` and `expire_credit_grants()` scheduled nightly via pg_cron.
