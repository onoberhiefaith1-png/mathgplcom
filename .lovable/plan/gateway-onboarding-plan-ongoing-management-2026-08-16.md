# Gateway = onboarding, Plan = ongoing management

Three small, separate fixes. No redesign of the pricing page, auth, or dashboards.

## 1. Back from the Gateway goes to the public MathGPL home page

Today the Back button falls back to the role's workspace (Teaching Hub). The public landing page ("Mathematics, Reimagined", About Us, the full marketing content) currently only renders at `/` for signed-out visitors — a signed-in teacher at `/` gets the rotating building instead, so there is no address that reliably shows it.

- Add a public route `/welcome` that always renders the existing landing page content (same loader and content source as `/`, no new design).
- Point the Gateway's Back button at `/welcome`.
- `/` behaviour stays exactly as it is today.

## 2. The Gateway appears only until a plan is chosen

Confirmed from the database: the teacher accounts each hold an active plan row (`teacher_free`), while the school and parent accounts hold none — so those accounts are correctly, but repeatedly, sent to the Gateway on every entry. That is the real state, not a display bug: once a plan is saved the redirect already stops, and choosing Free already writes a real subscription row, so Free counts as a chosen plan.

What changes:
- The Gateway becomes onboarding-only. On open, if the account already holds a plan (active or in renewal grace), or has full free access, or nothing is published for its type, it goes straight into the workspace instead of showing the chooser.
- An explicit visit from the dashboard (`/plans/gateway?change=1`) still shows the chooser, so upgrading is never blocked.
- The redirect into the Gateway from the building stays keyed to "no plan saved yet", unchanged.

Result: no plan saved → Gateway → choose Free or Pro → saved to the account → dashboard. Plan saved → straight to the dashboard, every time.

## 3. Plan becomes a visible dashboard item, placed before Pricing

The Plan panel exists on the dashboards but there is no navigation entry for it.

- Add **Plan** to the workspace navigation immediately before **Pricing** for teacher and school, and add it to the Parent Console (which has no Pricing entry).
- It links to the existing `/plans` page, where the current plan, upgrade, and subscription management already live.
- The dashboard Plan panel's "Choose a plan" button keeps pointing at the Gateway only when no plan exists; "Manage plan" continues to `/plans`.
- Teaching Hub navigation is otherwise untouched.

## Technical notes

- `src/routes/welcome.tsx` — new public route rendering `WelcomePage` with the `getSiteContent` loader and its own head metadata.
- `src/pages/plans/PlanGatewayPage.tsx` — Back fallback `/welcome`; add an effect that redirects to `WORKSPACE_PATH[role]` when `subscription || freeAccess || noPlansYet` and the `change` search param is absent.
- `src/components/workspace/workspaceNav.ts` — new `{ to: "/plans", label: "Plan", icon: CreditCard }` entry before the Pricing item in `TEACHER`, `SCHOOL`, and in `PARENT`.
- `src/components/plans/PlanSection.tsx` — "Choose a plan"/"Renew plan" links carry `?change=1` so the chooser still opens deliberately.
- No database or subscription-logic changes; plan state stays in `subscriptions`.
