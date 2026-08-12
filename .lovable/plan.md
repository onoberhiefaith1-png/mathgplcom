# Fix: saved cost per credit reverts to £0.31

## What's wrong

Your saves are landing correctly — the newest recorded cost per credit is **£0.37** (saved 22:15), and the history list in the panel shows it. But the pricing engine that every screen reads from throws that value away and falls back to the hardcoded default of £0.31.

The cause is in the database pricing resolver (`resolve_credit_pricing`): after it correctly reads the current rate, a second "fallback to GBP" lookup runs, and because the fallback query matches no rows it blanks the value it had just read. With the value blanked, the engine drops to the built-in default £0.31. Profit percentage is unaffected, which is why 40% shows correctly.

## What changes

1. Repair the resolver so the fallback only applies when there really is no rate for the requested currency, and never overwrites a value already found. After this, the engine returns £0.37 (and whatever you save next).
2. Because every customer-facing figure is derived from that one resolver, the fix flows automatically to:
   - **Credits & Economics** — Cost per Credit input shows £0.37, Credit Sell Price becomes £0.37 x 1.40 = £0.518.
   - **Plans → Live Economics** — Credit cost price £0.37, sell price updates, and each plan's included credits recompute from `credit budget / sell price`.
   - **Pricing pipeline / Paddle catalogue** — resynced against the new published amounts (the sync already runs on save).
3. Make the save refresh reliable: after saving cost per credit or profit percentage, refresh the plans dashboard, pricing engine and pipeline queries so the numbers move without a manual reload.

## What does not change

Nothing historical. Usage events, purchases and revenue keep the cost and profit rate stored on their own rows, so the Locked History block and the per-rate-period breakdown stay exactly as recorded (£0.31 usage stays £0.31). Active paid subscriptions keep their locked rate until renewal.

## Technical notes

- Additive migration replacing `public.resolve_credit_pricing(text, timestamptz)`: guard the GBP fallback with `IF v_cost IS NULL THEN ... END IF` instead of an in-query `AND (v_cost IS NULL)` predicate (a zero-row `SELECT INTO` nulls its targets in plpgsql). Keep signature, `STABLE`, `SECURITY DEFINER`, `SET search_path = public` and existing grants unchanged.
- No change needed in `costAdmin.server.ts` calculation logic; `resolvePricing`, `currencyPricing`, `record_usage_event` and `PlanDashboard` all consume the fixed resolver.
- `GlobalCreditEconomics.tsx`: broaden post-save query invalidation to the plan dashboard / pricing engine / catalogue keys, and clear the local draft so the input reflects the stored value.
