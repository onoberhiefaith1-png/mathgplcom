# Why payments still look unverified — and how to fix it

## What I checked

I asked Stripe directly about the payout account attached to your teaching workspace (`acct_1U4E95PzaGfPrrjW`, created 14 Aug 05:59). Stripe's answer right now:

- charges enabled: **no**
- payouts enabled: **no**
- details submitted: **no**
- card payments capability: **inactive**
- blocked because: **requirements past due**

The outstanding list includes business type, industry (MCC), product description, website, support phone, the responsible person's name, date of birth, address, email and phone, a **bank account**, and **Stripe's terms acceptance**.

Nothing has been submitted on this account at all. So the account that is live is your **own MathGPL Stripe account** (the platform account you signed into at dashboard.stripe.com) — that one being live is what lets the platform operate, but it is a different account from the one that receives your students' payments in this teaching workspace. That second account still has empty onboarding, which is exactly why the panel says "verification in progress" and keeps Payment active locked.

The app is reading Stripe truthfully; the state is real, not a display bug.

## What to change

### 1. Make the panel say which account it means

Right now the copy is ambiguous, which is how the two accounts got confused. The Payment card will state plainly that this is the payout account for this workspace, show its Stripe account reference, and note that your platform Stripe account being live does not complete it.

### 2. A working "Finish setup" path, with a fresh start option

- **Continue Stripe verification** keeps generating a new hosted onboarding link each click (links expire quickly).
- Because this account has submitted nothing, add **Start setup again** — visible only when Stripe reports `details_submitted: false`. It detaches the empty account and creates a clean one, so a half-broken or wrong-country account can never trap you. Accounts that have already submitted details are never discarded.

### 3. A visible checklist instead of raw Stripe field names

Replace the "Stripe is still waiting for: mcc, business_type…" line with a plain checklist: business type, industry, what you sell, website, support phone, your personal details, bank account for payouts, accept Stripe's terms. Each item in everyday words.

### 4. Refresh on return, plus a manual refresh

When Stripe sends you back to the pricing page (`?stripe=return`), re-read the status immediately, and add a small **Refresh status** action so you never have to reload the page to see progress.

### 5. Guard the go-live moment

Once Stripe reports charges enabled, the panel flips to connected and the Payment active toggle unlocks — unchanged behaviour, but with a short confirmation line so it is obvious money can now be taken.

## What you do after this ships

Click **Continue Stripe verification** (or **Start setup again**) and complete Stripe's form to the end — the last two steps, the bank account and accepting Stripe's terms, are the ones that were never reached. Verification is usually instant for a UK individual; the panel then unlocks Payment active.

## Technical notes

- `src/lib/gateway/stripe.functions.ts`: keep `getStripeStatus` as the single source of truth (it already re-reads Stripe and syncs `gateway_payout_accounts`); add `payoutsEnabled`, `disabledReason`, and a `resetStripeAccount` server fn that clears `stripe_account_id` only when the live Stripe read shows `details_submitted === false`.
- `src/lib/gateway/stripeConnect.server.ts`: widen `StripeAccount` with `payouts_enabled` and `capabilities`; no change to the v2 create/link path, which is working (the link is generated, it was simply never completed).
- `src/pages/gateway/PricingWorkspace.tsx`: account-identity copy, human-readable requirement checklist, `Start setup again`, `Refresh status`, and an invalidate-on-`?stripe=return` effect.
- No database migration needed; no change to checkout, plans, entitlements or the webhook.
