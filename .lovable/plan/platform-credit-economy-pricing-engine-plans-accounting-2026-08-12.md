# Platform Credit Economy: Pricing Engine, Plans & Accounting

Your platform sells **your own credits**. Lovable is only the upstream cost side. This build makes that explicit: a credit inventory you own, a pricing engine you control, plans whose included credits are derived automatically, and an accounting ledger that reads in credits first.

## Verified starting point

- `platform_cost_settings` currently holds profit 50%, credit rate £0.30, currency GBP; `pricing_versions` and `currency_rates` already give insert-only history for percentage and per-currency credit value.
- `subscriptions` already carries the snapshot columns (`locked_profit_rate`, `credit_price`, `currency`, `plan`, `discount_percentage`, `final_price`, period start/end) — 0 rows exist today.
- `credit_wallets` / `credit_ledger` exist per cost unit (0 wallets so far) — these are **user** wallets. There is no platform-owned inventory yet.
- `promo_codes` has a single `kind` column mixing promo and staff (1 row) — the two concepts are not separated.
- There is no payment provider connected anywhere in the codebase, and no plan-selection screen.

## 1. Cost side: your credit inventory

New **Platform Credit Inventory**: each purchase from your provider is a batch — credits purchased, cost per credit (starting £0.31), currency, date, note. The console shows Purchased / Consumed / Remaining, and consumption is read from the existing usage events, not entered by hand.

Base cost per credit moves from £0.30 to £0.31 as a new insert-only rate row, so nothing already recorded is repriced.

## 2. Pricing engine

```text
Cost per credit (£0.31)
  × (1 + profit %)          -> selling price per credit
50% -> £0.465   100% -> £0.62   200% -> £0.93
```

- One global default profit percentage, base currency GBP. No hard-coded 50% anywhere.
- Per-currency rows each have a **Controlled by GBP** toggle. On: the currency follows the GBP percentage automatically, and changing GBP updates it. Off: the admin sets that currency's own percentage and GBP changes never touch it. Switching back to On immediately adopts the current GBP percentage.
- Selling price is always calculated, never typed.
- Currency conversion is a separate layer applied after the selling price — fluctuations never change credit accounting.

## 3. Plans with derived credit allocation

A plan is defined as *subscription portion + credit-value portion*. Included credits are derived, not fixed:

```text
included credits = credit-value portion ÷ selling price per credit
Teacher Pro: £9.99 = £4.99 subscription + £5.00 credits
             £5.00 ÷ £0.465 = 10.75 credits at 50%
School Pro:  £49.99 = £19.99 subscription + £30.00 credits
             £30.00 ÷ £0.465 = 64.52 credits at 50%
```

Change the profit percentage and every plan's included credits recalculate on screen instantly.

Plan matrix:

| Account | Free | Pro | Super Pro |
| --- | --- | --- | --- |
| Student | no subscription | — | — |
| Teacher | yes | £9.99/mo | Coming Soon |
| School | — | £49.99/mo | Coming Soon |
| Parent | yes | admin-set price (same split structure) | — |

Super Pro appears as a disabled "Coming Soon" card with no details. Parent Free connects to schools only; Parent Pro connects to schools and teachers. Parent Pro price is set from the admin Plans screen — say the word and I'll seed a figure.

## 4. Subscription price lock

At the moment of subscribing, the subscription stores its own snapshot: plan, region/currency, profit percentage, credit cost price, credit selling price, included credits, pricing version, period start/end. Changing the global percentage tomorrow never alters an active subscription; renewal reads the then-current values. Same rule applies to the included credit allocation.

## 5. Promotions and staff access become separate systems

- **Promotions**: a discount on a real payment. Customer still checks out, discount applies, subscription records the discount and what was actually collected.
- **Staff access**: a code that grants entitlement with no checkout at all. Usage is still fully metered, so cost is recorded, collected is 0, and the result shows as negative exposure — you can see exactly what staff access costs.
- **Free plans**: charge 0, usage still metered, so the free tier's real cost is visible and measurable.

## 6. Accounting in credits

Ledger columns stay: When | Account | Activity | Category | Cost (credits) | Percentage Profit | Charge (credits) | Status | Result (credits).

```text
Paid    : cost 4, 50% -> charge 2, collected 6  -> +2 credits
Unpaid  : cost 4, 50% -> charge 2, collected 0  -> -4 credits exposure
Staff   : cost 20                               -> -20 credits
```

Status values become Paid, Unpaid, Free, Promotional, Staff — each preserved, never flattened. Top cards read Actual Cost, Expected Charge, Collected, Expected Profit, Unpaid/Exposure in credits, each with its GBP equivalent underneath at the rate locked to those rows.

## 7. Admin console sections

Pricing (base cost, global percentage, per-currency overrides with the GBP toggle, conversion), Credit Economy (platform inventory + user balances), Plans, Subscriptions (with locked snapshots), Promotions, Staff Access, plus the existing Usage and Accounting/Revenue pages which keep working exactly as they do.

## 8. Payments

Payments get enabled at the end of this build so the paid plans can actually check out. Your existing usage, credit and accounting engine stays the authority for credits, consumption, cost and profit — the payment layer only reports subscription and payment events back into it. Enabling asks you for a short business form and your business country; a test environment comes first, real money after verification.

## Technical section

- Additive migrations only: `credit_purchases` (credits, unit_cost, currency, purchased_at, note, created_by) for platform inventory; `currency_rates` gains `profit_percentage` + `follows_base` so per-currency overrides are versioned alongside their credit value; `plans` (key, audience, label, subscription_amount, credit_amount, currency, status, active) seeded with Teacher Free/Pro, School Pro, Parent Free/Pro and Coming Soon rows; `subscriptions` gains `included_credits`, `credit_sell_price`, `pricing_version_id`, `region`; `promo_codes` splits into `promo_codes` (discount) and `staff_codes` (entitlement, no checkout) with `staff_redemptions`. GRANTs + RLS on every new table: platform-owner select via `has_role`, service_role write, no anon.
- Pricing resolution helper in SQL (`resolve_credit_pricing(currency, at)`) returning cost price, percentage, selling price; `record_usage_event` calls it instead of reading globals, keeping snapshot writes as they are.
- Server: `costAdmin.server.ts` gains inventory, plan and staff-code reads/writes plus per-currency override save; exposed through `costs.functions.ts` behind `assertPlatformAdmin`. New `src/lib/plans/plans.server.ts` + `plans.functions.ts` for plan resolution and derived credit allocation, reused by both admin and signup.
- UI: split `/admin/cost-analytics` into Pricing, Credit Economy and Plans panels (new components under `src/components/admin/`), keep `/admin/usage-analytics` and `/admin/cost-revenue` intact, add Promotions and Staff Access panels. Derived selling price and included credits are computed client-side from the same shared formula module so the numbers move live as the percentage is edited.
- Plan-selection screens and checkout wiring follow once payments are enabled; nothing in the current signup flow is removed in this pass.
