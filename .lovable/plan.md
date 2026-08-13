# Stripe Connect: finish the setup, then harden the flow

## What I checked against your live Stripe account

- Your platform key works (account `acct_1U3lclPzaGMpwGyV`, GB, GBP).
- That platform account is **not activated**: `details_submitted: false`, `charges_enabled: false`, and every payment capability reads `inactive`.
- There are **zero** connected accounts, so no teacher has ever completed onboarding.

So your reading is right: this is not a "paste the key" problem. The key is correct and it is the platform secret, exactly as intended. What is missing is activation of the platform account and the Connect platform profile with Express accounts enabled.

The architecture already in the code is also the one you describe: teachers are created as **Express connected accounts**, Checkout is opened **on the connected account** (direct charges), and there is **no `application_fee_amount` and no `transfer_data`** anywhere — MathGPL takes £0 and never holds the money. No teacher ever enters a secret key; Stripe collects and verifies their details through its own hosted onboarding.

## What only you can do (in Stripe, not in code)

1. Complete the business/activation details on the platform account so it leaves the unactivated state.
2. Open the Connect page in the Stripe dashboard, complete the **platform profile**, and enable **Express** accounts.
3. Choose the pricing model where **Stripe charges the connected account** for processing, so the teacher bears Stripe's fee and MathGPL bears no Connect fees.
4. Register the webhook endpoint `https://mathgpl.com/api/public/webhooks/stripe` as a **Connect** endpoint (events listed below) and save its signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`.

Until steps 1–2 are done, `POST /v1/accounts` keeps failing, so the Connect Stripe button cannot succeed no matter what the code does.

## What I will change in code

### 1. A truthful, self-diagnosing Connect button

- Before creating an account, ask Stripe for the platform's own state. If the platform is not activated or Connect is not enabled, return one clear message to the owner ("Payments are still being set up on MathGPL — please contact support") and log the precise Stripe reason for you.
- Keep the error surfaced in a toast (already added) so a click never silently does nothing.

### 2. Reliable return from onboarding

- Fix the refresh link so an abandoned onboarding resumes properly, and land the return on `/{workspace}/pricing?stripe=return`.
- On seeing `?stripe=return`, force a fresh status read from Stripe, clear the query string, and toast either "Stripe connected" or "Stripe is still verifying your details".

### 3. Owner-visible verification detail

- When Stripe reports onboarding submitted but charges still disabled, show what Stripe is waiting for (its `requirements.currently_due` summary in plain words) with the resume link, instead of a bare "Verification in progress".

### 4. Paid plans appear automatically once the three conditions hold

The gate stays exactly as specified — plan published **and** connected account can charge **and** Payment switched on — and no other condition. I will make the gateway re-read status when a plan is saved or Payment is toggled, so Pro and Premium show up on `/g/$handle` immediately rather than after a manual reload.

### 5. Historical purchases stay frozen

Already true and I will keep it that way: `gateway_payments` records the amount, currency and billing mode at purchase time, and `gateway_entitlements.granted_items` snapshots the plan's items. A later price or item edit only affects new purchases; existing Stripe subscriptions keep their own terms.

## Technical notes

- Webhook events on the Connect endpoint: `account.updated`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`. Access is granted only by this signature-verified handler, never on button click or return URL.
- `STRIPE_CONNECT_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` are read only inside server handlers; neither is ever sent to the browser or shown to a teacher.
- Files touched: `src/lib/gateway/stripe.functions.ts`, `src/lib/gateway/stripeConnect.server.ts`, `src/pages/gateway/PricingWorkspace.tsx`, `src/lib/gateway/useGateway.ts`. No database migration is needed.
- Untouched: platform plans, credit economics, pricing snapshots, the gateway visibility rule itself, and the 0% fee model.
