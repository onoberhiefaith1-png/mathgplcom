# Fix: Connect Stripe and the Pro / Premium pipeline

## What I verified

- Your platform Stripe key is valid and reachable, but **Connect has never been switched on for it**. Creating a connected account returns, verbatim: *"You can only create new accounts if you've signed up for Connect, which you can do at dashboard.stripe.com/connect."* There are currently **zero** connected accounts on the platform — so no teacher has ever completed onboarding.
- The Connect button is fully wired to the real server function; it is not decorative. But its mutation has **no error handler**, so that 400 from Stripe is swallowed and the click looks like it does nothing.
- Pro and Premium are saving correctly. The public gateway function `gateway_by_handle` deliberately hides any plan priced above £0 unless the owner's Stripe account both has charges enabled and Payment is switched on. Because no Stripe account exists, every paid plan is filtered out — which is exactly the "Free flows through, Pro and Premium don't" symptom.

So there is one root cause with two visible faces: no Connect signup on the platform account, and a UI that hides the resulting error.

## One thing you must do (I cannot do it for you)

Sign up for Connect on the Stripe account behind `STRIPE_CONNECT_SECRET_KEY`: open https://dashboard.stripe.com/connect, complete the platform profile, and enable **Express** accounts. Until that is done, no teacher or school can onboard — this is a Stripe account setting, not code.

## What I will change in code

### 1. Never swallow a payment error again

`PricingWorkspace.tsx`: give the **Connect Stripe** and **Manage Stripe account** buttons `onError` toasts, matching the pattern already used by the Payment-active switch. Whatever Stripe says comes straight to the screen.

### 2. Translate the Connect-not-enabled error into plain language

`stripeConnect.server.ts`: when Stripe's message mentions signing up for Connect, raise a clear message instead — "Payments are not finished setting up on the MathGPL platform yet. Please contact support." Teachers should never see raw Stripe plumbing, and you will recognise it instantly in the workspace.

### 3. Tell the owner why their paid plans are invisible

`PricingWorkspace.tsx`: above the plan slots, when any plan has a price but `paymentsActive` is false, show one honest line — "Pro and Premium are saved but hidden from your gateway until Stripe is connected and Payment is on." The existing per-plan hint stays; this makes the state readable at a glance rather than only when a slot is expanded.

### 4. Nothing else moves

No redesign, no change to the gateway gate, entitlements, the webhook, the 0% fee model, platform plans, or the credit system. `gateway_by_handle` keeps hiding paid plans until payment is genuinely live — that rule is protecting students from unbuyable prices and should stay.

## After the Connect signup

Connect Stripe will open Stripe's hosted onboarding, the account will report `charges_enabled`, the Payment switch becomes usable, and Pro and Premium appear on `/g/$handle` with working Pay / Subscribe buttons. Access still comes only from the signature-verified webhook.
