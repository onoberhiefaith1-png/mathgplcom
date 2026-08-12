# Credit-Based Cost & Revenue Accounting

Credits become the platform's accounting unit. The existing usage pipeline stays exactly as it is — no new metering, no manual entry, no second analytics source. Only the accounting layer on top changes.

## Verified starting point

- All 23 recorded usage events come from the existing platform usage import and already carry their credits directly in `quantity` (metric `*.credits`). Nothing needs to be invented.
- The global setting today is Percentage Profit 50%, credit rate £0.30, currency GBP.
- There are 0 subscriptions, which is why every ledger row currently reads 0% profit and £0.00 charge: pricing is read only from a subscription row, and no fallback exists.
- Cost/charge/result are stored and displayed in GBP; there are no credit columns on usage events yet.

## 1. Credits first

Every accounting figure is calculated and shown in credits:

```text
Cost (credits) × Percentage Profit = Charge (credits)
Cost + Charge = customer total
Result (paid)  = collected − cost
Result (unpaid)= exposure, never counted as profit
```

Worked example: cost 4 credits at 50% → charge 2 credits → customer total 6 credits → paid 6 gives +2.00 credits; unpaid gives 0 collected, 6 credits exposure, −4.00 credits result.

Historical events keep their recorded credits exactly (e.g. 0.0018 credits shows as 0.0018 credits). Nothing is repriced.

## 2. Accounting Ledger

Columns become:

```text
When | Account | Activity | Category | Cost (credits) | Percentage Profit | Charge (credits) | Status | Result (credits)
```

- "Margin" is gone everywhere — table, drawer, summary.
- Charge is the profit component only; the row drawer shows cost, charge, customer total, collected, unpaid, result, plus the GBP equivalent at that row's own locked rate.
- Values render as credits (e.g. `2.00 credits`, `0.0018 credits`), never as pounds.

## 3. Percentage Profit resolution (fixes the 0% rows)

For each event the percentage comes from, in order:
1. the locked percentage of the account's subscription covering that moment;
2. otherwise the pricing version that was in force at the event's timestamp.

So today's 50% applies to current usage even without a subscription, and changing the percentage tomorrow never touches events already priced.

## 4. Locking and history

- Changing the percentage inserts a new pricing version; existing subscriptions and already-recorded events are untouched.
- Each subscription keeps its snapshot: percentage, credit buy rate, currency, plan, period start/end, discount, final price. Renewals open a new period and read the then-current values.
- Each usage event keeps its own snapshot: credits consumed, percentage applied, charge credits, credits collected, and the currency rate in force — so old rows never move when rates change.

## 5. Financial summary (credits)

Cards at the top of the analysis page: Actual Cost, Expected Charge, Collected, Expected Profit, Unpaid / Exposure — all in credits, each with a smaller GBP equivalent underneath. Unpaid is never labelled profit.

## 6. Admin pricing control

One Pricing Configuration card holds:
- Current Percentage Profit (any value; note that it applies to new subscriptions and future usage only) with its insert-only history.
- Credit Buy Rate per currency — GBP £0.30 to start, with rows addable later for USD, NGN, etc. Insert-only history so past periods keep their rate. Nothing hard-coded.

## 7. Views that stay

General vs single-account switch, category drill-downs (Data, Network, Storage, Compute, Realtime, AI), AI activity detail with model and credits, and realtime ledger updates all keep working — they just read credits instead of pounds.

## Technical section

- Additive migration: `usage_events` gains `cost_credits`, `charge_credits`, `paid_credits`, `credit_price` (rate snapshot); backfill from `quantity` for `*.credits` metrics and `actual_cost / credit_rate` otherwise, with the percentage resolved from `pricing_versions` at `occurred_at`. New insert-only `currency_rates` (currency, credit_value, effective_from, created_by) seeded with GBP 0.30 from `platform_cost_settings.credit_rate`. GRANTs + RLS: platform-owner select, service-role write.
- `record_usage_event` writes the credit columns and resolves the rate via subscription → pricing version fallback; `apply_usage_payment` records credits collected. `cost_unit_totals` gains matching credit columns so rollups agree with the ledger.
- Reads: `usageAnalytics.server.ts` `LedgerRow`/`RevenueLedger` expose `costCredits`, `chargeCredits`, `paidCredits`, `resultCredits`, `creditPrice`; `costAdmin.server.ts` gains currency-rate listing plus `setCurrencyRate`, exposed through `costs.functions.ts` behind `assertPlatformAdmin`.
- UI: a shared `credits()` formatter next to `money()` in `categories.ts`; `CostRevenueAnalysis.tsx` (columns, cards, drawer, subscription block), `CostAnalytics.tsx` (Pricing Configuration + currency rates), `UsageAnalytics.tsx` (unit wording only).
- Usage capture code (`meter.server.ts`, edge `usageMeter.ts`, import RPC) is not modified.
