# Teacher & School Gateway Pricing Workspace

An additive access-and-pricing layer owned by each teacher and each school. It does not touch Global Credit Economics, the platform Paddle subscription, or the platform-owner pricing pipeline. No payment processing in this stage.

## What gets built

### 1. Pricing workspace (Teacher and School)

- New **Pricing** section in the Teacher Dashboard (`/teaching-hub/pricing`) and in the School Console (`/school/pricing`), linked from the dashboard quick actions.
- Three plan cards side by side: **Free**, **Pro**, and a third editable slot (default name "Premium", renameable).
- Each card edits: plan name, description, price (GBP), included items, active/published toggle, and a per-plan "auto-grant to existing students" switch.
- Item picker is a checklist over the fixed master list: Class Notes, Smartboard, Assignment, Adventure, Gallery, Reports, Courses. Add/remove only — teachers never create or edit the underlying features here.
- Live preview strip on the page: PLAN -> WHAT STUDENTS GET -> PRICE. No analytics, no credits, no platform controls.

### 2. Seeded defaults

On first open, the three slots are created for that teacher/school:

- **Free** — Class Notes + Assignment, £0.00, published, so nothing breaks before setup.
- **Pro** — all seven items, price blank, unpublished.
- **Third slot** — empty items, unpublished.

### 3. Gateway

- Public gateway page per owner: `/g/$handle` (teacher or school), reachable from both entry points the student already uses — the public/live page link and the join-by-code flow, which both funnel into the same Gateway screen before content unlocks.
- Shows published plans as cards with included items and price, and a clear action button (Choose Free / Choose Pro / Choose Plan).
- Free plans grant immediately. Paid plans record a pending selection and show "Payment coming soon" — the button and data shape are already in place for the next stage.

### 4. Access logic

- Selecting a plan records an entitlement for that student against that teacher/school, storing a snapshot of the plan's items so later plan edits do not silently change what a student already has.
- A shared `useGatewayAccess(ownerId)` hook plus a guard component gates the seven categories inside that owner's student-facing surfaces. Items outside the plan show a locked state pointing back to the Gateway.
- Existing students: each plan has an auto-grant switch. When a teacher publishes with it on, currently connected students receive that plan's entitlement automatically; when off, they meet the Gateway on next visit.
- Entitlements are scoped per owner, so a student can hold different plans with different teachers and schools. Teacher and school configurations are fully independent.

### 5. Architecture prepared for direct payments (not implemented)

- Each owner gets a payout-configuration row (provider, account reference, status) so a future provider can be attached per teacher/school, keeping the flow Student -> Teacher/School rather than through MathGPL.
- Entitlement records carry optional payment fields and a source (`free`, `manual_grant`, `paid`) for the next stage.
- Per-item paid overrides are anticipated by a nullable `content_access` shape but no individual-content payment UI is built now. Courses stay a single gateway item.

## Technical notes

New tables (additive migration, with GRANTs and RLS):

- `gateway_plans` — owner_id, owner_kind (`teacher`|`school`), slot (`free`|`pro`|`third`), name, description, price_amount, currency, items (text[]), is_published, auto_grant_existing.
- `gateway_entitlements` — owner_id, owner_kind, student_id, plan_id, granted_items snapshot, source, status, payment reference fields.
- `gateway_payout_accounts` — owner_id, owner_kind, provider, external_account_id, status.

RLS: owners manage their own plans and see their entitlements; published plans are readable for the gateway; students read and create their own entitlements.

Front end: `src/lib/gateway/` (master item list, hooks, server functions), `src/pages/gateway/PricingWorkspace.tsx` shared by both dashboards with an owner-kind prop, `src/routes/g/$handle.tsx` for the Gateway. Existing dashboards, class flows, Paddle, and credit economics are left unchanged apart from the new nav entries and the access guard.
