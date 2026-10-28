# Public Pricing, Signup Gateway & Account Plans

Much of this already works: `/plans` shows read-only public pricing to visitors and the member plan screen to signed-in accounts, free plans activate instantly, and paid plans only activate on a confirmed payment. This change closes the four remaining gaps: the guest "Select" message, the post-verification Plan Gateway, the gate before the rotating building, and a Plan section on every dashboard.

No UI redesign. Teacher/School student pricing (the Gateway at `/g/:handle`), Stripe Connect and role separation are untouched.

## 1. Public pricing stays information only

On the visitor pricing page, each plan card gets a **Select** button that no longer navigates straight into signup. Clicking it reveals a short message on the card:

"Create your MathGPL account first. Create an account and verify your email before selecting a plan."

with two actions: **Create account** and **Log in**. Prices, features and credit packs stay exactly as they are — guests can read everything, buy nothing.

## 2. Verification leads into the Plan Gateway

The verified-email screen currently offers "Enter MathGPL". For an account type that subscribes (Teacher, School, Parent) it will offer **Choose your plan** and land on `/plans/gateway`. Students and the platform owner keep the direct "Enter MathGPL" button, since they never hold a platform plan.

## 3. New Plan Gateway at `/plans/gateway`

A signed-in-only screen that reads the same published plan versions and live credit price as everything else:

- Plan cards for the account's audience with price, included credits and features.
- Free plan: activates immediately, no payment, then continues into the workspace.
- Paid plan: goes through checkout; the plan is only activated when the payment is confirmed. Returning from checkout shows a "we are confirming your payment" state until the subscription appears.
- If nothing is published for that account type yet, the screen says so and offers **Continue to my workspace** — nobody is locked out.
- An account that already has an active plan is sent on to its workspace instead of being asked again.

## 4. Gate before the rotating building

Teacher, School and Parent accounts with no active plan, where plans exist for their type, are sent from the homepage to the Plan Gateway on arrival. Students, the platform owner, and anyone with an active plan go straight through. If the administrator has published no plans for an account type, the gate stays open.

## 5. Plan section on every dashboard

One reusable Plan card — current plan, price, included credits, renewal date, a past-payment warning when relevant, and **Manage plan** / **Choose a plan** — added to the Teacher, School, Parent and Student dashboards, the reports area and the homepage account menu surface. It renders nothing for accounts that hold no plan of their own (Student, platform owner), so student dashboards stay clean.

The wording keeps the two ideas apart:
- **Pricing** = configuring plans (administrator, and teachers/schools pricing their own students).
- **Plan** = the account's own subscription.

## Technical notes

- New `src/lib/plans/usePlanGate.ts`: single source for "does this account subscribe, does it have a plan, are any published" using existing `fetchMyPlan` and `fetchPublishedPlans`. Role→audience mapping lives here and replaces the copy inside `PlansPage.tsx`.
- New `src/pages/plans/PlanGatewayPage.tsx` + route `src/routes/plans/gateway.tsx` (head metadata included), reusing `startFreeSubscription`, `usePaddleCheckout` and `priceKeyForPlan`.
- New `src/components/plans/PlanSection.tsx`, mounted in `TeacherDashboard`, `SchoolDashboard`, `FamilyDashboard`, `StudentDashboard` and the reports dashboard.
- Edits: `PublicPricingPage.tsx` (guest Select message), `VerifiedPage.tsx` (gateway destination), `Index.tsx` (gate), `PlansPage.tsx` (use the shared hook).
- No schema change: `subscriptions.status` / `payment_state` already carry the pending and past-due states, and existing rows keep their locked price and version.
