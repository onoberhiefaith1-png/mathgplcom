# Credits, GBP and pricing history corrections

Focus: Admin → Credits & Economics and Admin → Usage & Revenue. No changes to unrelated features.

## What is already in place (verified)

- `pricing_versions` is append-only and stores cost per credit, profit percentage and sell price per version; saving either input writes a new version.
- The current-economics card already derives sell price as `cost × (1 + profit%)` from the two inputs and previews it as you type.
- `credit_grants` already carries the locked economic tag per lot (`cost_per_credit_at_purchase`, `sell_price_at_purchase`, `customer_multiplier`, `remaining`), FIFO consumption walks lots oldest-first, and `payment_transactions` already stores the split (`service_amount` = subscription fee, `credit_amount` = prepaid credits, `credits_allocated`).
- The financial summary already separates cash received, prepaid credit cash, prepaid outstanding, realised usage revenue, platform cost, realised profit and exposure.

So the remaining work is display correctness (units), one new lots view, and the history container — not a rebuild of the accounting engine.

## 1. Credits vs GBP in the display

Usage & Revenue summary cards currently print GBP for values that are credit quantities. Correct them to credit units, with GBP shown only as a clearly labelled equivalent underneath:

- Metered cost → credits (hint: "GBP equivalent £x.xx")
- Customer charge → credits (hint: GBP equivalent)
- Collected → GBP only, and only money actually received; credits deducted move to their own card ("Credits used")
- Run credits → credits (already correct)

Sweep the two admin pages and the economics panel so no `£` sits beside a credit quantity and no credit consumption is described as a GBP charge. Where a GBP figure is genuinely money (subscription payment, cash collected, platform cost paid to providers), keep `£` and label it as money received / paid.

## 2. Current economics updates immediately

Keep the derived sell-price card, and harden it: typing `0` or clearing an input must not fall back to the stored value, the derivation line reads `£cost × (1 + profit%) = £sell`, and the card is labelled "preview — not yet live" until Save. Saving writes a new pricing version and refreshes every dependent panel.

## 3. Historical rates stay locked

No recalculation from current inputs anywhere. Locked history keeps reading the rate stored on each record. Add a short explicit note that the current rate applies to new transactions only.

## 4. Subscription payment split, shown clearly

In the accounting ledger, a payment row shows the total plus its two parts on the same row:
total £9.99 = subscription fee £4.99 (revenue now) + credit purchase £5.00 (prepaid, not revenue). Payments missing a stored split are derived from the plan version's platform/credit amounts and labelled as such rather than silently counted as revenue.

## 5. Credit lots panel (new)

Add a "Credit lots" table to the Credits & Economics page listing, newest first: purchase date/time, credits purchased, GBP paid, locked cost per credit, locked profit %, locked sell price, credits consumed, credits remaining, status (active / exhausted / expired). Fed by a new admin server function reading `credit_grants`; read-only.

## 6-8. FIFO and real-time position

FIFO already governs consumption; the lots panel makes the order visible and shows a usage event spanning two lots as two accounting parts. The financial position panel gains the full per-account line-up in one block: subscription purchased, subscription fee received, credit amount purchased, prepaid credit balance, credits consumed, platform cost, customer credit charge, money collected, recognised revenue, profit, exposure, remaining prepaid value. Ledger and Usage Analytics keep reading the same `usage_events` / `payment_transactions` data, and both refresh live on new rows.

## 9. Pricing version history container

Replace the inline history list with a compact fixed-height panel:

- Newest first, 3 records visible, container height fixed so the page never grows.
- Each row: version label, locked cost per credit, locked profit %, sell price derived from those locked values, effective date/time, and a "Current" or "Locked" tag.
- "View all history" toggle scrolls older records inside the panel only; nothing is deleted.
- Current pricing stays visually separate from the locked history.

## Technical notes

- Files: `src/pages/admin/UsageAnalytics.tsx`, `src/pages/admin/CostRevenueAnalysis.tsx`, `src/components/admin/GlobalCreditEconomics.tsx`, `src/components/admin/FinancialPositionPanel.tsx`, plus a new `src/components/admin/CreditLotsPanel.tsx` and a new `PricingHistoryPanel` extracted from the economics panel.
- Server: new lots reader in `src/lib/costs/costAdmin.server.ts` exposed via `costs.functions.ts`; extend the payment ledger rows in `usageAnalytics.server.ts` with the derived split flag.
- No schema migration expected — the required columns already exist. If a lot predates the locked-rate columns, it is shown as "rate not recorded" rather than back-filled with today's rate.
