# Stripe Connect for Teacher & School Workspaces

Teachers and schools connect their own Stripe account, set their own prices, and receive student payments directly. MathGPL takes £0 — no platform fee, no markup, no credits, no connection to the platform's own pricing or economics. Stripe's processing fees are charged to the connected account, exactly as Stripe defines them.

Scope of this build: **paid gateway plans only** (Free / Pro / Third slot). Per-item content pricing (individual assignments, adventures, notes, courses, live sessions) is deliberately left for a later stage; the data shape will allow it without rework.

## What gets built

### 1. Payment section in Pricing

A new **Payment** card at the top of `/teaching-hub/pricing` and `/school/pricing`:

- Not connected: `Payment: Not Connected` + **Connect Stripe** button.
- Clicking it starts Stripe's official Connect onboarding (Express/Standard hosted flow) in a new tab. Stripe collects all identity, business and bank details — MathGPL never reproduces or stores any of it.
- On return, the status refreshes from Stripe: `Stripe Connected ✓`, plus **Manage Stripe Account** (Stripe-hosted login/dashboard link) and a **Payment active** switch.
- If Stripe reports onboarding incomplete (charges not yet enabled), the card says `Verification in progress` and keeps the resume link.

Payment stays completely optional: a workspace with no Stripe connection behaves exactly as it does today.

### 2. Activation rule

Paid plans only become sellable when **both** are true: Stripe reports the connected account can accept charges, **and** the owner has switched Payment on.

Until then:

- Paid plans cannot be published (the publish switch explains why).
- Students see no prices, no pay buttons, no checkout — only free plans.

### 3. Per-plan billing mode

Each plan slot gains a billing choice the owner controls:

- **Free** (£0)
- **One-off payment**
- **Monthly subscription**

Price and billing mode are the owner's alone. Changing a price affects only new purchases; students already paying keep the terms of their existing Stripe subscription.

### 4. Gateway checkout

`/g/$handle` stays a public, shareable page (as chosen). Behaviour per plan:

- Free plan → granted immediately, as now.
- Paid plan → **Pay £X** / **Subscribe £X per month** → Stripe Checkout hosted by Stripe, created **on the connected account** with a £0 application fee.
- Access is granted **only** after Stripe confirms payment via webhook — never on button click or on return from Checkout. The return page shows "Confirming your payment…" until the webhook lands.

### 5. Subscription lifecycle

A Stripe webhook keeps student access in step with Stripe's own truth:

- checkout completed → entitlement becomes `active` with a snapshot of that plan's items
- subscription renewed → stays active
- payment failed / subscription cancelled / refunded → entitlement moves to `revoked` (or `pending_payment` while Stripe retries)

Existing snapshot behaviour is preserved: a later plan edit never silently changes what a student already holds.

### 6. Payment records in the workspace

A **Payments** panel in Pricing listing each purchase: plan, student, amount, currency, status, date, Stripe reference. No card data — the owner uses their own Stripe dashboard for full financial records.

### 7. Student-access items — unchanged

Class Notes · Smartboard · Assignment · Adventure · Gallery · Reports · Courses — Video Link · Courses — Premium Video. The two course items stay separate, controlled independently per plan with the existing + / − controls. No checkmarks are hard-coded.

## Technical notes

- **Platform key.** Stripe Connect requires one platform account to create connected accounts. We store your Stripe secret key as a server-side secret (`STRIPE_SECRET_KEY`) used only to (a) create/refresh connected accounts and onboarding links and (b) create Checkout Sessions on behalf of a connected account with `application_fee_amount` omitted entirely, so 100% of the charge minus Stripe's own fees settles into the teacher's/school's account. Requesting that secret is the first implementation step.
- **Server functions** in `src/lib/gateway/stripe.functions.ts` (+ `stripe.server.ts` helper): `startStripeOnboarding`, `refreshStripeStatus`, `openStripeDashboard`, `createPlanCheckout`. All authenticated via `requireSupabaseAuth`; the platform key is read inside handlers only.
- **Webhook** at `src/routes/api/public/webhooks/stripe.tsx`, signature-verified with `STRIPE_WEBHOOK_SECRET`, listening on Connect events (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `charge.refunded`) and writing entitlements with the admin client.
- **Migration (additive, with GRANTs + RLS):** extend `gateway_payout_accounts` (`stripe_account_id`, `charges_enabled`, `details_submitted`, `payments_active`); extend `gateway_plans` (`billing_mode`, `stripe_product_id`, `stripe_price_id`); extend `gateway_entitlements` (`stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id`, `current_period_end`); new `gateway_payments` table (owner, student, plan, amount, currency, status, stripe ids, created_at) readable by the owner and the paying student.
- **Untouched:** platform plans, `plan_versions`, credit economics, `pricing_versions`, Paddle catalog sync, and every existing snapshot/locking rule. Nothing in this feature reads or writes the credit system.
- **UI:** `PricingWorkspace.tsx` gains the Payment card, billing-mode selector and Payments panel; `GatewayPage.tsx` gains checkout buttons and a confirming state; `useGateway.ts` gains the Stripe status/checkout hooks. `GatewayGate.tsx` logic stays as is.
