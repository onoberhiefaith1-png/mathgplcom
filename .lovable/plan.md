# MathGPL Cost Unit & Profit Accounting

An internal accounting layer only. No existing dashboard, hub, class, lesson-note, smartboard, adventure or Skill Builder behaviour changes. Users never see a Cost Unit or the profit percentage.

## What exists today (verified)

- There is no subscription table, no usage/metering table and no per-user cost data anywhere in the project.
- AI calls (notebook-ai, floating-*, smart-*, geometry-*, grade-*, gen-sfx, covers) do not record token or byte usage.
- The Lovable Analytics available to the app is site-level (visits, pageviews) and workspace-level credit spend. It cannot be broken down per MathGPL user, so it can't be the per-user source of truth on its own.

So the authoritative per-user figures are produced by metering inside MathGPL: each billable operation records what it really consumed, and an admin price book converts that into money.

## 1. Cost Units

- A Cost Unit is created automatically for every account (`CU-000001`) and for every workspace/school (`CU-SCHOOL-001`), permanently tied to the user or org id. Backfilled for all existing accounts.
- Six categories only: Database, Network, Storage, Compute, Realtime, AI. Nothing about Security, SEO, connectors or agents.
- Each usage event has exactly one billing owner. Work done inside a paid school/shared workspace bills the workspace Cost Unit; personal work bills the user Cost Unit. Never both.

## 2. Metering

Every billable operation writes one usage event with a measured quantity:

- AI — input/output tokens per model, images generated, audio seconds (read from the provider response, not estimated).
- Compute — server function / edge function invocations and duration.
- Storage — bytes added or removed per bucket and per stored record family.
- Network — response bytes on metered endpoints and asset egress.
- Realtime — channel session minutes and message counts from presence/sync channels.
- Database — rows written and query volume on the metered write paths.

Events are attributed to the acting user plus the active workspace, so ownership is decided at write time.

## 3. Price book

A platform-owner page holds the current provider rate for each metered unit (per 1M input tokens, per 1M output tokens, per image, per audio minute, per GB-month, per GB egress, per 1k invocations, per realtime minute, per 1M rows). Rates are versioned with an effective date so historical events keep the rate that applied when they happened. No prices are hard-coded and none are invented — an unset rate reads "Provider rate required" and contributes £0 until set.

## 4. Charge and profit

- One global setting: Profit Percentage.
- Charge = actual cost × (1 + profit rate). Profit = charge − actual cost.
- Every paid subscription stores `subscription_profit_rate`, locked at the moment the paid period starts. Changing the global rate never alters an active subscription; the next period picks up the new rate.
- Free accounts still get a Cost Unit and still accrue Database/Network/Storage/Compute/Realtime cost, with charge £0, so profit shows as a negative subsidy.
- Accounting is live: each event updates its Cost Unit immediately, and a reconciliation pass corrects figures when authoritative provider data arrives later.

## 5. Subscriptions and payment

Payments are enabled through Lovable's built-in integration (Pro plan required; an eligibility check runs first and I'll confirm the provider with you before enabling). A completed checkout creates the subscription record — subscription id, owner user or workspace, plan, start, end, locked profit rate, Cost Unit — and renewals open a new period that re-reads the current global rate. No plan limits, paywalls or feature gating in this step; plans and prices come after you review the numbers.

## 6. Admin views (platform owner only)

New **Cost Analytics** section next to Billing & Costs in the Platform console:

- Top chart of usage/cost across the six categories, togglable per category, with 24h / 7d / 30d / 90d / custom range.
- Under it: Total Actual Cost, Total Customer Charges, Total Profit, Profit Margin.
- Search Users by name, email, MathGPL ID or account type; selecting one opens that Cost Unit — the six category lines, actual cost, charge, profit.
- Profit Report table: user/workspace × six categories × actual cost, charge, profit, sortable and filterable.
- Profit Percentage setting lives here, with a note of how many active subscriptions are locked to older rates.
- A user's Cost Unit is also reachable from their account row in the console.

```text
account created -> cost unit
usage happens   -> metered event (owner = user or workspace)
event x price book rate -> actual cost
locked subscription rate -> customer charge -> profit
-> cost unit totals -> user cost analytics -> global analytics -> profit report
```

## Technical section

- Additive migration only: `cost_units`, `usage_events`, `cost_unit_totals` (rolled-up per category/period), `resource_prices` (versioned), `platform_cost_settings` (global profit rate), `subscriptions` (with `locked_profit_rate`). GRANTs plus RLS on every new table; usage/cost tables readable only by platform owner via `has_role`, written by service role.
- Cost Unit creation via trigger on `profiles`/`organizations` insert, plus one backfill.
- Metering helper `src/lib/costs/meter.server.ts` called from existing AI/server-function/storage paths — added instrumentation only, no behaviour change; edge functions record usage through a service-role insert.
- Rollups and reconciliation via a scheduled server route under `src/routes/api/public/costs/*`, verified by secret.
- Admin UI: `src/pages/admin/CostAnalytics.tsx`, `src/routes/admin/cost-analytics/index.tsx` (noindex), reusing `DashboardShell` and the existing chart components; reads through platform-owner-guarded server functions.
- Checkout and webhook wiring follows the payment provider knowledge issued when payments are enabled; the webhook is the only writer of subscription periods and locked rates.
