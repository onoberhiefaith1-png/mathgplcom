# Dynamic Percentage Profit + Subscription Rate Lock

Nothing is removed. This tightens the pricing layer around one rule: the global percentage is changeable at any time, and each subscription keeps the percentage that was active when it started.

## What already works (verified)

- Each usage event stores its own snapshot: cost, `profit_rate`, charge, discount, amount paid, status. Changing the global setting never rewrites past rows.
- The rate applied to an event is already read from the customer's active subscription (`subscriptions.locked_profit_rate`) for the period the usage falls in — not from the global setting.
- Financial result is already `amount collected − actual cost`, and unpaid exposure is tracked separately.

So the locking logic exists at event level. What is missing: a pricing history, the full subscription pricing snapshot, the admin control with its warning, the customer-level pricing view, and the ledger wording/values.

## 1. Pricing configuration (admin)

On the pricing page, a clear **Pricing Configuration** card:

- Current Percentage Profit input + **Save New Percentage**.
- Note underneath: "This percentage applies to new subscriptions only. Existing active subscriptions keep their locked percentage until their current period ends."
- **Pricing history** table below: Effective From, Percentage Profit, Status (Current / Historical). Old versions are never deleted or edited.

Any percentage is allowed (20, 40, 50, 75, 100, 200, …).

## 2. Subscription pricing snapshot

When a subscription starts (or renews), it records its own snapshot: account, subscription id, plan, period start, period end, currency, credit price, Percentage Profit, discount, final price, status. That stored percentage is what all usage in that period is priced with. A renewal opens a new period and reads whatever the global percentage is at that moment, so one account can show 50% for August and 100% for September, and two accounts can hold different percentages at the same time.

## 3. Accounting Ledger changes

Columns become:

```text
When | Account | Activity | Category | Cost | Percentage Profit | Charge | Status | Result
```

- "Margin" disappears from the table, the transaction drawer and the summary cards.
- **Percentage Profit** shows the percentage for that transaction (e.g. `50%`), taken from the row's own snapshot — not the current global setting.
- Charge = Cost × (1 + Percentage Profit ÷ 100). Result = Collected − Cost.
- Summary cards read: Actual Cost, Expected Charge, Collected, Financial Result, Unpaid Exposure. Unpaid exposure is never labelled profit or loss.
- Discounted rows keep their original Percentage Profit; the discount stays a separate adjustment, and the result follows what was actually collected.

Worked example, as required: cost £3.00 at 50% → charge £4.50; collected £0.00 → result −£3.00, unpaid exposure £4.50; collected £4.50 → result +£1.50; collected £2.25 after a 50% discount → result −£0.75.

## 4. Customer view

Opening an account in the analysis page shows a **Subscription Pricing** block: plan, period, Percentage Profit, credit value, status — plus that account's earlier periods, so a rate change is visible as history rather than a rewrite.

## 5. Untouched

Usage Analytics and the metering pipeline stay exactly as they are: usage → actual cost → account → active subscription → locked percentage → charge → discount/status → payment → financial result. Real data only, no mock rows.

## Technical section

- Migration (additive): `pricing_versions` (percentage, effective_from, created_by) with insert-only history, seeded from the current `platform_cost_settings.profit_percentage`; `subscriptions` gains `plan_id`, `currency`, `credit_price`, `discount_percentage`, `final_price` for the snapshot. `setProfitPercentage` writes a new pricing version and updates the current setting; a helper returns the percentage effective at a given timestamp for new subscription creation. GRANTs + RLS: platform-owner read, service-role write.
- `record_usage_event` keeps resolving the rate from the subscription row — no change to its lock behaviour.
- Reads: `usageAnalytics.server.ts` `LedgerRow` swaps `margin` for `profitRate` (from `profit_rate`) and the summary drops `margin` in favour of expected charge / collected / exposure; `costAdmin.server.ts` gains pricing-version listing and per-account subscription pricing, exposed through `costs.functions.ts` behind `assertPlatformAdmin`.
- UI: `CostRevenueAnalysis.tsx` (ledger column, drawer, cards, subscription pricing block), `CostAnalytics.tsx` (Pricing Configuration card + history), `UsageAnalytics.tsx` (hint text wording only).
