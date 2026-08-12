# Simplify admin economics to three sections

Today the admin console links to five economics pages: Billing & Costs, Cost Analytics, Usage Analytics, Usage & Revenue, Plans. The underlying data is already correct and already derived from one chain — the problem is that it is scattered. This consolidates the interface into three sections without deleting any data or capability.

## Target structure

```text
PLANS                  Plan inputs + derived customer price + read-only Pricing Pipeline
CREDITS & ECONOMICS    Cost per credit, profit %, derived sell price, credit-to-GBP position
USAGE & REVENUE        Everything time-based: usage over time, revenue over time, subscriptions
```

## 1. Plans (`/admin/plans`)

Stays the source of truth. Kept as-is, with two changes:

- Per plan the administrator edits only: name, description, Platform Amount (£), Credit Budget (£), features. Customer Price (`platform + credit budget`) and Included Credits (`credit budget ÷ credit sell price`) stay derived and non-editable.
- The Pricing Pipeline panel remains embedded here and stays read-only: Plan, Published price, Checkout price, Sync state (IN SYNC / OUT OF SYNC), per test and live. No editable price fields.
- Draft → Publish workflow untouched. Publishing continues to push to the payment provider and report drift.
- The stale cross-link to "Cost analytics" is replaced with a link to Credits & Economics.

## 2. Credits & Economics (`/admin/credits`)

New page that absorbs Billing & Costs, Cost Analytics and the credit/inventory panel. Existing server functions are reused; no new tables.

Editable (exactly two inputs, GBP only):

- Cost per Credit (£) — saved through the existing GBP credit-rate writer
- Profit Percentage (%) — saved through the existing profit-percentage writer, which already versions the rate

Derived and read-only:

- Credit Sell Price = cost × (1 + profit/100); shown precise (£0.465) with the rounded customer-facing value (£0.47) beside it
- Credits Issued / Used / Remaining, and their GBP value at the current sell price

Also moved here (unchanged behaviour): credit purchase/inventory records, resource price book, reconcile action, staff codes, the platform cost catalogue download that Billing & Costs currently holds, and per-account cost breakdown search.

Removed from the interface: the multi-currency pricing table and currency-rate management (USD/EUR/NGN rows and follows-base switches). GBP becomes the only internal reference currency; the payment provider handles customer currency at checkout. The `currency_rates` table and its writers stay in place so historical records keep resolving — only the non-GBP editing UI goes away.

## 3. Usage & Revenue (`/admin/usage-revenue`)

Absorbs today's Usage Analytics page and Usage & Revenue ledger into one time-oriented page:

- Time filters: Today, 7 days, 30 days, 3 months, 12 months, All time
- Credit usage over time, revenue over time
- Active subscriptions, active teachers, active schools
- Credits consumed by teachers vs schools
- Revenue and usage per plan (Teacher Pro, School Pro, …)
- The existing revenue ledger, credit grants and promo/staff redemption views stay available here

No cost/profit/sell-price editing on this page — those belong to Credits & Economics.

## Navigation

The Platform console keeps Security, Email Dashboard and Add account, and shows exactly three economics links: Plans, Credits & Economics, Usage & Revenue. Old paths (`/admin/billing`, `/admin/cost-analytics`, `/admin/usage-analytics`, `/admin/cost-revenue`) become redirects to their new homes so existing links and bookmarks do not 404.

## Existing subscriptions stay locked

This behaviour already exists and is preserved, not rebuilt: a subscription stores its plan version, purchased price, included credits and the profit rate in force when it started. Changing cost per credit, profit % or a plan price affects the published plan, the pipeline, the public pricing page and new checkouts only. Existing subscribers keep their purchased terms until renewal or a deliberate plan change. The Credits & Economics page will state this next to the two editable inputs.

## Technical notes

- Pages: new `src/pages/admin/CreditsEconomics.tsx` and `src/pages/admin/UsageRevenue.tsx`, composed from the existing panels in `CostAnalytics.tsx`, `BillingCosts.tsx`, `CreditEconomyPanel.tsx`, `UsageAnalytics.tsx` and `CostRevenueAnalysis.tsx`. New routes under `src/routes/admin/credits/` and `src/routes/admin/usage-revenue/`, each with its own `head()` metadata; the four old route files become redirects.
- Server layer: no schema changes, no new server functions. `sellPrice`/`includedCredits` in `src/lib/pricing/sellPrice.ts` remain the single derivation point. `savePlanPricing` (the older direct plan-amount writer used by `CreditEconomyPanel`) is dropped from the UI so plan amounts are edited only through the versioned plan workflow.
- Multi-currency: `saveCurrencyPricing`/`saveCurrencyRate` remain callable for GBP; the non-GBP UI is removed.
