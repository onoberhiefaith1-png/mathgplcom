# Current pricing vs locked history

## What I verified first

The snapshot machinery you describe already exists in the backend and is working:

- Each usage event stores its own `credit_price`, `profit_rate`, `cost_credits`, `charge_credits` and cash cost at the moment it happened. All 23 recorded events carry a rate of £0.30 and a total real cost of **£23.14**.
- Each subscription stores `credit_price`, `credit_sell_price`, `locked_profit_rate`, `included_credits`, `final_price` and its plan version at activation.
- Credit purchases store their own `unit_cost`.
- Cost per credit and profit percentage are insert-only versioned, so past versions are never overwritten.

The fault is in the reading, not the storing. The Global Credit Economics panel multiplies historical credit totals by **today's** derived sell price:

```text
Credits used 77.14  →  77.14 × £0.434  =  £33.48   (recomputed with today's rate)
Recorded truth      →  £23.14           (what those events actually cost)
```

So the £33.48 in your screenshot moves every time you change the inputs — exactly the behaviour that must stop. Nothing in the database needs unlocking; the history is intact, it is just being displayed through the current rate.

## 1. Split the panel in two

**CURRENT ECONOMICS (live, editable)**

- Cost per credit (input)
- Profit percentage (input)
- Credit sell price (derived, read-only) = cost × (1 + profit ÷ 100)

While you are typing, the derived figure is labelled as a preview until Save is pressed; only a save creates a new version.

**LOCKED HISTORY (read-only, never recalculated)**

- Credits used and their recorded cost, taken from the stored per-event figures (£23.14 today, not 77.14 × today's rate)
- Credits purchased and their recorded spend, taken from each purchase's own unit cost
- Credits remaining, in credits only — with no pounds figure attached, since a remaining balance has no single historical rate
- A small table of the rate periods actually in force, each with the credits and cash recorded under it:

```text
Period                Cost    Profit   Sell price   Credits   Recorded cost
12/08 13:25 →         £0.30   50%      £0.45        77.14     £23.14
12/08 21:57 →         £0.60   40%      £0.84        0.00      £0.00
```

Both blocks carry a one-line statement: current values apply to new subscriptions, renewals and future usage only; every figure under Locked history keeps the rate it was recorded with.

## 2. Everything downstream stays derived

Unchanged and confirmed already in place — the plan only makes sure the panel states it and links to it:

```text
Cost per credit + Profit %  →  Credit sell price
Plan platform amount + credit budget  →  Customer price, included credits
Published plan  →  Pricing pipeline (read-only)  →  Public pricing page  →  Checkout guard
```

Saving either input already re-syncs the provider catalogue and refreshes the plan dashboard; the panel will invalidate the plan and pipeline views on save so the new figures appear without a reload.

## 3. Existing subscribers

No change in behaviour, and the panel will say so beside the inputs: an active subscription keeps its stored cost basis, profit rate, sell price, included credits and price until renewal or a deliberate plan change. Renewal reads the then-current values.

## Technical section

- `src/components/admin/GlobalCreditEconomics.tsx`: remove the three `credits × derived` money figures; render a Current block and a Locked history block; label the derived price as a preview while a draft is present; add invalidation of `plan-dashboard`/pipeline queries on save (partly present).
- `src/lib/costs/costAdmin.server.ts` → `creditInventory()`: add `consumedCost` summed from `usage_events.actual_cost` (its stored per-event rate) alongside the existing credit totals, and keep `spend` as-is since it already uses each purchase's own `unit_cost`.
- New read in the same module: rate-period rollup joining `currency_rates`/`pricing_versions` effective windows to `usage_events` grouped by `credit_price`/`profit_rate`, exposed through `costs.functions.ts` behind the existing platform-admin guard.
- No migration, no writer changes, no recalculation of any stored row.
