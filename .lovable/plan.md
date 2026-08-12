# Usage Analytics + Cost & Revenue Analysis

Two connected administrator-only pages built on the metering pipeline that already exists in this app. One measurement layer, one financial layer, one source of truth. No customer-facing dashboard, hub or class view changes.

## What already exists (verified)

- Live metering is in place: every AI edge function, storage upload, compute invocation and client-reported event writes a row to `usage_events` through `record_usage_event`.
- `usage_events` already stores, per event: category, metric, quantity, unit, `unit_price`, `actual_cost`, `profit_rate` (snapshot), `customer_charge`, `profit`, `feature`, `model`, actor, cost unit, `occurred_at`. Historical pricing is therefore already immutable per event.
- `cost_unit_totals` holds the per-day, per-category rollup; `resource_prices` is the versioned price book; `platform_cost_settings` holds the global profit percentage; `subscriptions` holds `locked_profit_rate`.
- `/admin/cost-analytics` exists today as a single combined page: stacked cost chart, category totals, price book editor, profit-rate control, Cost Unit table.
- What does not exist yet: payment status / discount / promo / staff reason per event, a credit wallet with balances and per-event deduction, realtime push updates, per-event drill-down tables per category, an AI activity table, and the all-usage / per-user switch.

Platform Cost stays sourced from app metering only, priced by the admin price book — nothing estimated, nothing entered by hand, no second metering system.

## Page A — Usage Analytics

Split out of the current page so measurement stands on its own.

- Header switch: **All usage | Users**. Users mode lists accounts (with role, MathGPL ID, workspace) and search; picking one re-renders the exact same interface filtered to that account. Same page, not a second one.
- Period selector: 24 hours, 7 days, 30 days, 90 days, custom.
- Stacked usage chart across the six categories — Database, Network, Storage, Compute, Realtime, AI — with each category toggleable to isolate it, matching the reference usage graph.
- Summary cards per category plus Total Usage, all for the selected period.
- Category drill-downs: clicking a category opens its own paginated event table (time, activity/feature, metric, quantity, unit, unit cost, cost, account). Only fields the events actually carry.
- AI section: real AI activity table — time, request/activity, model, requests, tokens, credits/cost, account — with an expandable row per event showing its full recorded metadata.
- Richer labels going forward: metering calls start recording a resource label (bucket, table, endpoint, channel) where the call site already knows it, shown in the drill-down as "—" for older events.
- Realtime: subscribe to inserts on `usage_events` so the chart, cards and tables move without a refresh.
- Empty and error states: "No usage recorded for this period" per section, and an explicit "Usage data temporarily unavailable" with retry instead of zeros.

## Page B — Cost & Revenue Analysis

Reads the same events; adds nothing to the measurement layer.

- Financial summary cards for the period: Total Platform Cost, Expected Revenue, Revenue Received, Gross Profit, Unpaid Exposure, Total Usage, Effective Margin.
- Revenue ledger — one row per usage event: date/time, user, activity, category, platform cost, margin applied, customer charge, discount, payment status, financial result. Positive results green, negative red, sorted and filterable by user, category, status.
- Payment status per event: Paid, Unpaid, Free plan, Promotional/Discounted, Staff/Marketing. The reason is preserved, never flattened into "not paid".
- Financial result rules: paid → received minus platform cost; unpaid → the full expected charge shown as a negative exposure; discounted → based on what was actually received, never the full margin.
- Transaction detail drawer: user, timestamp, category, activity, model, platform cost, margin at time of transaction, expected charge, discount/promo, amount paid, status, financial result.
- All Users / individual user switch mirroring Page A, with per-user totals: usage, platform cost, expected revenue, received, unpaid, discounts, profit or loss, and full transaction history.
- Immutability: every row displays its own stored snapshot. Changing the global margin later never rewrites past rows; only new events pick up the new rate.

## Credits, charging and codes

- Credit wallet per account: balance, ledger of purchases/grants/deductions.
- Charging happens per event, at the moment it is metered: platform cost × (1 + active margin) is deducted from the actor's wallet (workspace wallet for shared-workspace work, personal otherwise) and the event records the status.
- Insufficient balance blocks further chargeable generation, with a clear message on the feature that triggered it rather than a silent failure.
- Promotional codes (percentage discount) and staff/marketing entitlement codes: redeeming attaches the code to the account so subsequent events record code, discount percentage, original charge, discounted charge, amount paid and result.
- Free-plan usage records charge 0 with status Free, so it reads as a measured subsidy.

## Access and performance

- Both pages are platform-owner / co-admin only, enforced server-side on every read, not just by route. Ordinary users only ever see their own credit balance.
- All aggregation happens in SQL over indexed `occurred_at` / `cost_unit_id` / `category`; tables are server-paginated; the browser never loads the full event history.

```text
metered usage event -> usage_events (cost, margin snapshot, charge)
   -> Usage Analytics (chart, categories, AI activity, per-user)
   -> wallet deduction + payment status
   -> Cost & Revenue Analysis (ledger, summaries, per-user, detail)
```

## Technical section

- Additive migration: `usage_events` gains `payment_status`, `discount_percentage`, `promo_code`, `amount_paid`, `resource_label`; new `credit_wallets`, `credit_ledger`, `promo_codes`, `promo_redemptions`. GRANTs + RLS on each; wallet readable by its owner, financial columns readable only via platform-owner server functions.
- `record_usage_event` extended to resolve the actor's wallet, apply the active margin and any attached discount, write the charge/status, and deduct — all inside the one transaction so analytics and accounting can never disagree.
- Reads: new functions in `src/lib/costs/costAdmin.server.ts` for series, per-category event pages, AI activity, ledger pages and per-user rollups, exposed through `src/lib/costs/costs.functions.ts` behind `assertPlatformAdmin`.
- UI: `src/pages/admin/UsageAnalytics.tsx` (`/admin/usage-analytics`) and `src/pages/admin/CostRevenueAnalysis.tsx` (`/admin/cost-revenue`), both noindex, reusing `DashboardShell` and the existing recharts components. The current `/admin/cost-analytics` keeps the price book and profit-rate settings and links to both new pages; console links updated.
- Realtime via a Supabase channel on `usage_events` inserts, invalidating the relevant TanStack Query keys.
