# Complete the prepaid MathGPL credit and accounting pipeline

The engine you asked for mostly exists already: credit lots are stamped with the cost, profit percentage and multiplier that applied at purchase; usage is priced from the metered underlying cost and deducted oldest-lot-first at each lot's own locked multiplier; subscription payments are already split into a service component and a credit component. What is missing is the accounting *presentation* and a few connections: money is shown where credits belong, the ledger only contains usage (no subscription or credit-purchase events), prepaid money is not separated from realised profit, there is no Add Credits button on the account pages, and the admin screens do not refresh by themselves.

This plan corrects those, without replacing what works.

## 1. Customer wallet is always credits

- Add an **Add Credits** button next to the balance in the Credits section on the Teacher, School and Parent account pages. It goes straight to the existing signed-in credit-purchase area (the credit packs on the Plans page), not to plan selection.
- Credit Activity gains a running balance and the date/time on every row, and keeps its plain wording ("Credit purchase", "AI generation", "Realtime session"). No cost, profit percentage, multiplier, lot or exposure is ever shown to a customer.
- The balance and activity keep updating live, and now also react to a purchase landing, not only to a deduction.

## 2. Fix the currency/credit unit bug in admin

Three places print a customer's credit balance as pounds — the account selector and the selected-account line on Cost & Revenue, and the accounts table on Usage Analytics ("Faith Onoberhie — £10.75"). These become `10.75 credits`. Money stays only where it is money: cost, cash received, revenue, profit.

Every admin figure gets an explicit unit, so a credit figure is never printed with a £ sign and a pound figure is never labelled "credits".

## 3. Separate prepaid money from realised profit

Add a single authoritative admin summary that keeps these apart instead of blending them:

- **Cash received** — subscription payments plus credit purchases actually collected.
- **Subscription revenue** — the service component of each payment, recognised immediately.
- **Prepaid credits outstanding** — credits issued and not yet consumed, valued at the price they were sold for. This is a liability, not profit.
- **Realised usage revenue** — the value of prepaid credits actually consumed.
- **Underlying cost** — the metered platform cost of that usage.
- **Realised profit** — realised usage revenue minus underlying cost.
- **Exposure** — only genuinely unfunded usage (free, staff-funded, partially covered). Prepaid consumption never appears here.
- **Refunds / reversals** and **Net financial result** (subscription revenue + realised usage revenue − underlying cost − refunds).

Existing cards (Actual Cost, Expected Charge, Collected, Expected Profit, Financial Result, Unpaid) stay, re-labelled and fed from these definitions so they stop implying that a credit purchase is profit.

## 4. Accounting ledger becomes the full financial record

Today the ledger reads usage events only. It becomes one merged, filterable timeline of three kinds of event:

- **Subscription payment** — total paid, subscription component, credit component, credits issued, plan, provider reference.
- **Credit purchase / top-up** — amount paid, credits issued, lot reference, locked cost basis, locked profit percentage, sell price.
- **Usage** — activity, category, underlying cost (money and credits), lot consumed, that lot's locked profit percentage, customer charge in credits, profit, status, reference.

Each row shows Cost / Charge / Collected / Profit / Prepaid / Exposure as distinct columns. Filters: account, date range, category, kind and status. Nothing is ever rewritten — refunds and corrections appear as new rows.

## 5. Prepaid enforcement and lot integrity

- Keep the existing pre-flight reservation so a chargeable generation cannot start without sufficient available credits, and confirm every chargeable path goes through it (AI generation, realtime, storage, compute, marking).
- Where a running operation cannot be fully funded, it stops and the customer is asked to top up — it is never silently absorbed.
- Confirm each new purchase always creates its own lot with its own locked terms, and that consumption is strictly oldest-lot-first across lots with different locked rates.

## 6. Real-time refresh

Admin Usage & Revenue, Credits & Economics and the Accounting Ledger subscribe to usage, ledger, purchase and payment changes and refresh themselves, matching the customer wallet's existing live behaviour. No manual reload, no cached figure.

## Technical notes

- Reads/labels: `src/pages/admin/CostRevenueAnalysis.tsx` (lines ~422, ~467), `src/pages/admin/UsageAnalytics.tsx` (~208) switch from `money()` to `credits()`.
- New server function in `src/lib/costs/usageAnalytics.server.ts` (`financialSummary`) computing the section-3 metrics from `usage_events`, `payment_transactions`, `credit_purchases`, `credit_grants` and `credit_ledger`; exposed through `src/lib/costs/usage.functions.ts`.
- `revenueLedger` extended to merge `payment_transactions` and `credit_purchases` rows with `usage_events`, with a `kind` discriminator and the existing per-row locked figures.
- Customer side: `src/components/plans/CreditsSection.tsx` gains the Add Credits link, running balance column and a `credit_ledger` realtime subscription alongside the existing wallet one.
- No schema rewrite is planned: `credit_grants` already stores `cost_per_credit_at_purchase`, `profit_percentage_at_purchase`, `sell_price_at_purchase`, `customer_multiplier` and `purchase_id`; `usage_events` already stores `cost_credits`, `charge_credits`, `paid_credits`, `credit_lot_id`, `pricing_version_id` and balances; `payment_transactions` already stores `service_amount` and `credit_amount`. Any additive column needed for refund tracing (e.g. a reversal reference) will be added by migration only, never by editing history.
- Customer-facing server responses continue to omit cost, profit and multiplier fields; the admin-only fields stay behind the platform-owner policies already in place.
