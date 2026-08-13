# Make the existing "Connect Stripe" button work (test mode first)

No new payment system, no change to the pricing design, plans, dashboards or the £0-fee direct-charge model. Only the Connect link between your existing Pricing page and Stripe is repaired.

## What I verified against your live Stripe API

- The saved key is a **test-mode** key belonging to `acct_1U3lcl…` ("MathGPL", GB, GBP). That platform account is now **activated**: `details_submitted: true`, `charges_enabled: true`, `card_payments: active`.
- Listing connected accounts returns **200 with an empty list**, so Connect *is* enabled for this key and no teacher has onboarded yet.
- The setup link you sent is for a **different** account, `acct_1U486h…`. Reading it with the saved key returns 403 `account_invalid` — that link belongs to another (live/separate) Stripe account, so it cannot be used by this integration. As you said, it will not be hard-coded; per-teacher links get generated fresh.
- The earlier blocker ("you must sign up for Connect") no longer applies in test mode, so the current failure is most likely the second half of the flow: account creation options and the return trip. I have not yet created a test connected account, so the exact remaining Stripe message is unconfirmed — step 1 below is to capture it.

## Steps

1. **Capture the real error.** Add explicit logging of Stripe's status + body around connected-account creation and the account link, and surface Stripe's own message in the toast on the Pricing page instead of a generic failure. One click then tells us exactly what Stripe objects to.
2. **Make account creation Connect-correct.** Create Express accounts with `controller`-style settings appropriate to your platform: teacher-paid Stripe fees, Stripe-hosted onboarding and Stripe-hosted dashboard, only `card_payments` + `transfers` requested, and `business_type` left to Stripe for teachers. Drop anything Stripe rejects for GB Express accounts.
3. **Reliable round trip.** `refresh_url` regenerates a fresh onboarding link for the same account (resume after abandon); `return_url` lands on `/teaching-hub/pricing?stripe=return` (or `/school/pricing`). On return, re-read status from Stripe, clear the query string, and toast "Stripe connected" or "Stripe is still verifying".
4. **Honest state on the Pricing page.** If Stripe reports submitted-but-not-chargeable, show what it is waiting for in plain words with a Resume verification link. Keep the existing note that paid plans stay hidden until Stripe is connected and Payment is on.
5. **Verify end to end** by driving a real test onboarding for a teacher account and confirming: account created and stored against that teacher, Stripe-hosted onboarding opens, return lands back on Pricing, status flips to charges enabled, Payment switch becomes usable, and Pro/Premium appear on `/g/$handle`.

## Going live later

When you want real money: add the **live** secret key for whichever account you intend to charge on, register a **Connect** webhook endpoint at `/api/public/webhooks/stripe`, and save its signing secret. Nothing else changes — the same code paths serve both modes.

## Technical notes

- Files touched: `src/lib/gateway/stripeConnect.server.ts`, `src/lib/gateway/stripe.functions.ts`, `src/pages/gateway/PricingWorkspace.tsx`, `src/lib/gateway/useGateway.ts`. No migration needed; `gateway_payout_accounts` already holds `stripe_account_id`, `charges_enabled`, `details_submitted`, `payments_active`.
- Each teacher keeps their own connected account row keyed by their platform user id and owner kind; no teacher ever types banking or verification data into MathGPL.
- Unchanged: direct charges on the connected account, no `application_fee_amount`, no `transfer_data`, webhook-only access grants, platform plans, credits.
- Side fix while I am in there: the homepage currently throws a React hydration error because the AdSense `<ins>` tag is injected into server-rendered markup; I will render that ad slot client-side only.
