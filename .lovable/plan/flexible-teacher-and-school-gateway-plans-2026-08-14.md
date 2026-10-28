# Flexible Teacher and School Gateway Plans

## Goal
Make every published Free, Pro, and third plan move from the teacher/school pricing editor to the public gateway with the exact saved features and prices. Add one-time, monthly, and yearly purchase options, preserve each student’s purchased terms, and enforce every selected feature with an upgrade path.

## Verified current behaviour
- All three plan rows and edited values are saved in `gateway_plans`; the reported teacher currently has Free, Pro, and Premium published with updated prices.
- The public gateway query deliberately hides every paid plan until the owner’s payment account is verified and “Payment active” is on. That is why only Free currently appears.
- Gateway billing currently supports Free, permanent one-time payment, or monthly subscription. Yearly billing and a configurable yearly discount do not exist in this gateway.
- Purchased features are copied into `gateway_entitlements`, but the payment webhook currently reads the live plan at confirmation time rather than the checkout snapshot.
- The gateway’s per-feature check exists, but it is only mounted once without a feature key. Student lesson notes, assessments, adventures, gallery, reports, courses, assignments, and smartboard routes are not individually enforced.

## Implementation

### 1. Make publishing and preview reliable
- Keep three independent plan slots: Free, Pro, and renameable third plan.
- Save and validate each plan’s name, description, exact feature selection, publication state, and pricing configuration as one atomic update.
- Refresh the pricing preview and public gateway immediately after saving or publishing so the latest Free-plan features and all other edits appear without stale defaults.
- Show every published plan on the owner’s gateway. If a paid plan cannot yet be purchased because payment setup is incomplete, keep it visible with a clear unavailable/setup state instead of silently removing it.
- Preserve the existing payment safety rule: checkout cannot begin until the connected payment account is verified and activated.

### 2. Add flexible payment choices
- Model purchase options separately from plan identity so one plan can offer any enabled combination of:
  - Free
  - One-time payment with permanent access
  - Monthly subscription
  - Yearly subscription
- Add yearly controls to both teacher and school pricing pages.
- Let the owner enter a yearly discount percentage; calculate and display the annual total and savings immediately from the monthly price.
- Add a Monthly / Yearly selector on gateway plan cards when both are offered, with the correct amount and billing label before checkout.
- Create the corresponding one-time, monthly, or yearly Stripe Checkout session on the owner’s connected account.

### 3. Lock purchased terms
- Snapshot plan name, selected features, billing interval, paid amount, currency, yearly discount, and effective access terms when checkout starts.
- Activate access from that immutable payment snapshot after the verified webhook, never from a plan that may have been edited after checkout began.
- Existing one-time purchases remain active permanently unless refunded/revoked.
- Existing monthly/yearly subscriptions retain their original Stripe price and feature snapshot through their paid period; later plan edits affect only new purchases or an explicit student upgrade.
- Store and maintain subscription period end/status from verified payment events, including renewal, payment failure, cancellation, and refund handling.

### 4. Enforce one-to-one feature access
- Expand and normalize the gateway feature catalogue so the editor’s selectable items correspond directly to real student capabilities, including Lesson Notes, Assessments, Assignments, Smartboard, Adventure, Gallery, Reports, and both course access types.
- Add a central gateway-access mapping from each student route/action to its feature key.
- Keep all pages discoverable, as requested; when a student opens a feature absent from their plan, render an upgrade state instead of hiding or breaking the page.
- The upgrade action opens that teacher/school gateway and highlights plans containing the requested feature, with the current monthly/yearly/one-time price choices.
- Enforce the same feature check in protected data-changing/server paths, not only in navigation UI, so direct URLs cannot bypass the plan.

### 5. Data compatibility and migration
- Use an additive migration to add billing-option configuration and immutable purchase snapshot fields while retaining existing plan IDs, entitlements, and payment history.
- Convert existing `free`, `one_off`, and monthly `subscription` plans into the new option structure without changing active students’ access.
- Keep teacher/school gateway pricing separate from MathGPL platform plans, credits, and platform profit calculations.

## Validation
- Test teacher and school owners independently.
- Publish three plans with different feature combinations and verify all three appear immediately on `/g/:handle` with exact text, features, and prices.
- Verify a changed Free plan updates for new selections while existing purchased snapshots remain unchanged.
- Test free selection, permanent one-time checkout, monthly checkout, and yearly checkout with 0% and 10% discounts.
- Change a live plan after purchase and verify the existing student keeps the locked price/features while a new student sees the new offer.
- Test every mapped student feature by direct URL and UI navigation: included features open; excluded features show the correct upgrade prompt and matching plans.
- Test renewal, failed payment, cancellation, and refund webhook states, plus responsive teacher/school editor and student gateway views.

## Technical notes
- Continue using verified Stripe Connect webhooks as the only authority for paid activation.
- Keep plan configuration live and mutable, but make purchase/entitlement snapshots immutable for historical accuracy.
- Apply database grants, row-level policies, validation, and idempotent webhook handling to all added fields/records.