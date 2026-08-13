# One connected money pipeline: payments → credits → usage → profit

No page is redesigned. The existing admin economics pages, plan gateway, pricing pages, dashboards and checkout stay where they are; what changes is the machinery underneath them, so an event that happens once flows through everything automatically.

## What is already in place (verified)

- Wallets, FIFO credit grants with 1-year expiry, and a credit ledger table all exist, with an admin/owner read policy.
- Plan versions already store the money split: `price`, `platform_amount` (service component) and `credit_amount` (credit component), plus the locked profit percentage, credit cost and derived included credits.
- Subscription activation already allocates included credits and writes a payment transaction; credit top-ups already allocate credits and are idempotent per provider reference.
- The payment webhook already claims every provider event once, so duplicate deliveries are ignored.
- Usage is metered for real across AI, compute and network, priced against the versioned price book, and rolled into per-day totals.
- The single global input pair (cost per credit £0.37, profit percentage 40%) lives in one settings row.

## The four real gaps

1. **Usage never touches the wallet.** `record_usage_event` prices an event and stores cost/charge, but no credits are deducted, so the balance shown to a customer is unaffected by what they use.
2. **No reservation and no floor.** Nothing stops two simultaneous operations from spending the same credits, and nothing stops a running operation from consuming past zero.
3. **Enforcement is client-side.** The only credit check runs in the browser before one AI call, so a direct request bypasses it entirely.
4. **The subscription payment split is not recorded.** The split exists in the plan definition but the payment row stores only one total, so the dashboard cannot separate subscription revenue from credit sales.

## 1. Usage consumes credits

Every usage event gets a customer credit charge and deducts it from the responsible wallet in the same transaction that records the event:

```text
metered quantity -> platform cost -> cost in credits -> x profit percentage
   -> customer credit charge -> deducted from wallet -> ledger entry
```

Platform cost, customer credit charge and profit stay three separate stored numbers on the event; the charge is what leaves the wallet, never the raw cost. Every event carries a unique operation key, so a repeated delivery of the same event deducts nothing a second time.

Free accounts are credit-controlled too: their workspace resource usage (database, network, storage, compute, realtime) is charged to their allowance and blocks when exhausted.

## 2. Reservation, floor and forced stop

The wallet gains a reserved amount, and available-to-use = balance − reserved.

```text
start request -> available <= 0.50 credits ? -> BLOCK, show top-up
              -> available  > 0.50 credits ? -> reserve, run
running       -> meter continuously
              -> available approaches 0.30  -> forced stop, cancel as soon as possible
finish        -> reserved converted to consumed; unused reservation released
              -> balance clamped at 0.00, never negative
```

No expensive pre-flight cost prediction: the 0.50 threshold gates *starting* a new operation, the 0.30 threshold protects MathGPL *during* one. A forced stop shows "Unable to complete request." and records the credits actually consumed. Reservation is what makes two concurrent 1.50-credit operations on a 2.00 balance resolve as one allowed, one rejected.

## 3. Server-side enforcement and plan permission

The check moves out of the browser. Every chargeable server entry point — AI functions, metered server functions, storage writes, realtime sessions — opens a credit context that reserves before work starts and settles afterwards. A request made directly to an endpoint gets the same answer as one made through the UI.

Alongside credits, plan permission is enforced server-side: AI generation is refused outright for free teacher and free parent accounts rather than run and quietly costed, and the free teacher student cap (5) is enforced at the point a student is added, with the school taking responsibility when one is connected.

## 4. Payment split and revenue truth

On every confirmed payment the webhook stores the split it already knows from the plan version: service component, credit component, credits allocated. Pending and failed payments allocate nothing; refunds reverse both the revenue and the credits. The admin financial view then reports subscription revenue and credit sales as separate lines that add up to the payment total, against real platform cost, for a live profit and margin.

## 5. One authoritative value everywhere

Cost per credit, profit percentage, plan price, service/credit split and credit conversion are read from the one settings/plan-version source by pricing pages, the plan gateway, checkout, the wallet and the analytics pages. Changing cost per credit from £0.31 to £0.70 changes every dependent figure at once; already-recorded events and active subscriptions keep their locked snapshots, which is correct history rather than a stale value.

## 6. Live balance, no refresh

Wallet, ledger and usage rows push their changes, so the balance updates itself in the dashboard, the credit page and the generation interface at the moment credits are reserved or consumed, and after a reload, sign-out or a second device it reads the same because it comes from the ledger.

Subscription status and credit balance stay separate: a subscription can be active with a zero balance, which blocks credit-consuming actions only.

## Insufficient-credit experience

An account below the floor sees, in place of the action: "You don't have enough credits to complete this action" with the required and available amounts, and an Add Credits button that opens the existing top-up flow.

## Technical section

- Additive migration: `credit_wallets.reserved`; `credit_reservations` (wallet, cost unit, operation key, credits, status, created/expires); `usage_events.operation_key` unique; grants/RLS matching existing tables (owner read own, platform owner read all, service-role write).
- New DB functions: `reserve_credits` (atomic, respects the 0.50 floor and reserved amount), `settle_credit_reservation` (consume/release, clamped at zero), `credit_headroom` (balance, reserved, available). `record_usage_event` extended to compute `charge_credits`, deduct through the existing FIFO grant logic, write a ledger row and honour `operation_key` idempotently.
- `activate_subscription` and `paddle_record_topup` write the split columns on `payment_transactions` (`service_amount`, `credit_amount`); refund/`payment.refunded` handling reverses both.
- Server side: `src/lib/costs/creditContext.server.ts` wrapping reserve → run → settle; `meter.server.ts` and `supabase/functions/_shared/usageMeter.ts` pass the operation key and settle reservations; edge functions gain a pre-flight gate plus a mid-flight abort check. `creditGuard.ts` becomes a UI hint only — the authority is server-side.
- Plan permission helpers (`aiAllowedFor`, free student cap) enforced in the AI functions and the add-student path, surfaced in the UI as disabled states.
- Reads: existing `usageAnalytics.server.ts` / `costAdmin.server.ts` queries extended with credit charge, reserved and split columns; existing realtime subscription extended to wallet and ledger channels.
- End-to-end verification against the sandbox: subscription purchase → split → wallet → operation → reserve → consume → analytics; insufficient-credit block; two concurrent operations; cost-per-credit change; top-up; reload/relogin persistence.
