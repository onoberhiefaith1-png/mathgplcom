# Credit Lots: Locked Economics, Real Deduction, Customer History

The existing pipeline (admin economics -> pricing versions -> checkout -> wallet -> reservation -> usage events -> deduction -> analytics) is already wired end to end. Four things do not yet match the rules in this brief. This plan fixes exactly those, additively, without redesigning any screen.

## What is confirmed in the system today

- Admin economics: cost per credit lives in `currency_rates.credit_value` / `platform_cost_settings.credit_rate`, profit in `pricing_versions.profit_percentage`, and `resolve_credit_pricing` already derives sell price = cost x (1 + profit/100). Sell price is never typed in.
- Purchases: `paddle_record_topup` records the purchase and calls `adjust_credits`, which creates a row in `credit_grants` (the lot table) with `remaining`.
- Consumption: `consume_credits` already walks grants oldest-first (FIFO) and writes a `credit_ledger` line with `balance_after`.
- Reservation and floors: `reserve_credits` / `settle_credit_reservation` / `credit_headroom` enforce atomic holds, the 0.50 start floor and the 0.30 stop floor. Negative balances are already impossible.
- Every metered category (ai, cloud, compute, storage, network, realtime) already routes through `record_usage_event`, which deducts credits.

## The four real gaps

1. **Credit lots are not locked to their pricing terms.** `credit_grants` has no pricing version, cost basis or multiplier. Nothing records the economics at purchase time.
2. **Deduction re-derives today's margin.** `record_usage_event` computes `charge_credits = cost_credits x (1 + current_or_subscription_rate/100)`. So a later margin change silently reprices credits a customer already bought — the thing the brief forbids.
3. **A pricing version does not capture cost per credit.** `pricing_versions` stores profit only, so a change to cost per credit creates no new version and history is incomplete.
4. **No customer-facing credit activity, and no credit-usage on/off control.** There is a balance in the plan area but no simple "what I did / what it cost / what remains" list, and no payer-level switch to stop chargeable actions.

## The work

### 1. Complete the pricing version record (additive migration)

Add to `pricing_versions`: `cost_per_credit`, `sell_price`, `label` (e.g. `PV-2026-08-13-54`). A new version row is created whenever cost per credit **or** profit percentage is saved in Credit Economics — never an update in place, so history stays intact. `resolve_credit_pricing` returns the resolving version id alongside the numbers.

### 2. Lock every credit lot at purchase (additive migration)

Add to `credit_grants`: `pricing_version_id`, `cost_per_credit_at_purchase`, `profit_percentage_at_purchase`, `customer_multiplier` (= 1 + profit/100), `sell_price_at_purchase`, `purchase_id`.

`adjust_credits` and `paddle_record_topup` stamp the lot with the version effective at purchase time. Credits granted by a plan allowance are stamped the same way. Existing grants are backfilled from the version effective on their `granted_at`, so nothing loses its basis.

### 3. Deduct using the lot's own multiplier

Rework the charge step of `record_usage_event`:

```text
provider cost -> cost_credits (cost / cost_per_credit at event time)
then walk lots oldest-first:
  take = min(lot.remaining, outstanding cost_credits x lot.customer_multiplier)
  deduct `take` credits from that lot
  outstanding reduces by take / lot.customer_multiplier
```

A single action can therefore span two lots at two different multipliers, exactly as the brief describes. `consume_credits` gains a cost-credit mode so the multiplier is applied per lot rather than once up front. Today's rate is used only to price the provider cost into cost-credits, never to reprice a purchased credit.

Add to `usage_events`: `credit_lot_id` (the lot that paid first), `pricing_version_id`, `balance_before`, `balance_after`, `payer_cost_unit_id`. Add `credit_lot_id` and `pricing_version_id` to `credit_ledger` for the audit chain. Idempotency via `operation_key` stays as is.

Payer resolution is unchanged — `resolve_cost_unit(user, org)` already sends a student's or teacher's usage to the school or teacher wallet — so nothing new is invented there.

### 4. Credit usage permission switch

Add `credit_usage_enabled boolean not null default true` to `cost_units`. `credit_headroom` returns `blocked_reason = 'disabled'` when the payer has it off; `reserve_credits` therefore refuses new chargeable work while everything non-chargeable continues. Surface the toggle in the existing school and teacher account settings, with the message: "Credit usage is currently disabled for this account."

### 5. Customer credit activity (customer-facing, no internals)

A `Credits` panel added to the existing account/dashboard plan area:

```text
CREDIT BALANCE      8.46 Credits

CREDIT ACTIVITY
AI Lesson Generation      -1.54
Real-Time Session         -0.42
Cloud Storage             -0.18
Top-up                    +8.77
```

Fed by a new authenticated server function reading `credit_ledger` joined to the action label only. It returns no provider cost, margin, multiplier or pricing version. The balance already updates from the single authoritative wallet; the panel subscribes so it refreshes as soon as a deduction lands.

### 6. Admin traceability

The existing admin usage tables gain the columns needed for the full chain: user -> payer -> action -> resource -> provider cost -> pricing version -> locked multiplier -> credit lot -> credit deduction -> balance before/after. No new admin page.

## Deliberately not changed

Dashboards, pricing page, checkout, plan gateway, products, free-plan feature permissions, advertising, subscription/top-up separation, floors (0.50 / 0.30), and the no-expensive-pre-check rule are already correct and stay as they are. No parallel credit system is introduced.

## Technical notes

- All schema work is additive migrations with GRANTs; existing rows are backfilled, none rewritten.
- Lot walking happens inside `SECURITY DEFINER` plpgsql under `FOR UPDATE`, preserving the current atomicity guarantee against concurrent spends.
- Precision: credits stored as `numeric`, displayed to 2 decimals.
