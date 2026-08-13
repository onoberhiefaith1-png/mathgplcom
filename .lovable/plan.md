# Plan → Entitlement → Access

Turn plans into the real source of truth for what an account can do. Today `plan_features` only stores marketing bullet lines, and access is decided by role capabilities (`role_capabilities` / `useAccount().can`). This adds a proper entitlement layer on top of the existing plans, subscriptions, connections and credit system — nothing is replaced.

## 1. Entitlement catalogue (database)

New tables, additive:

- `feature_entitlements` — the catalogue: `key` (e.g. `create_lesson_notes`), `label`, `category` (teaching / assessment / ai_usage / connections / school_admin), `applies_to` (which audiences may hold it), `sort_order`. Seeded with every feature listed in the brief.
- `plan_entitlements` — one row per (plan, feature) that is ON, plus optional `limit_value` for numeric caps. Admin toggles write here.
- `plan_limits` — named numeric caps per plan (`max_classes`, `max_students`, `null` = unlimited).

Existing `plan_features` stays exactly as it is, used only for the customer-facing description bullets.

Seed values for the four configurations in the brief (Teacher Free with `max_classes = 1`, `max_students = 5`; Teacher Pro, School Pro, Parent Free, Parent Pro) are inserted in the same migration so the system is live on first load.

## 2. Effective entitlements resolver

One security-definer SQL function `effective_entitlements(user_id)` plus a thin server function wrapper. It returns the union of:

- entitlements from the account's own active subscription's plan (grace/expired still counts for access — spending stays paused as today),
- entitlements granted *through a connection*: a Teacher Free connected to a paying School Pro inherits the school-provided teaching entitlements; a Parent Free connected to a school inherits the school's student-visibility entitlements,
- the account's role (a role can never gain an entitlement its audience does not support — a parent never gets `ai_generation`).

Each returned row is tagged with its source (`own_plan`, `via_school`, `via_teacher`) and the paying account, so "who pays" is answerable and the parent/school payment routes (Route A / Route B) are represented in data rather than in page code.

When no plan is published for an audience, the resolver stays permissive for that audience — nobody gets locked out of a workspace by a missing catalogue, matching how `usePlanGate` already behaves.

## 3. Client hook and gate components

- `useEntitlements()` — cached React Query hook exposing `has("create_lesson_notes")`, `limit("max_classes")`, `source(key)`.
- `<RequireEntitlement feature="...">` — renders children when allowed, otherwise a professional upgrade panel ("Lesson Note generation is available on Teacher Pro…") with an **Upgrade** action to the existing plan gateway.
- `useUpgradeGuard()` — for buttons and handlers: blocks the action and raises the same upgrade dialog instead of silently hiding.

Existing `RequireCapability` / role guards stay; entitlements sit alongside them (role decides *which* workspace, entitlement decides *what inside it*).

## 4. Server-side enforcement (the part that matters)

Every protected path re-checks the entitlement on the server, so a hidden button is not the security boundary:

- Lesson-note creation and all AI generation server functions / edge calls: check `create_lesson_notes` / `ai_generation` before doing work; return a structured `403 entitlement_required` payload the UI renders as the upgrade message.
- Assignments, Adventure, Skill Builder, Reports, Progress, Real-Time Sessions, MathGPL Live, Export, Cloud Storage upload paths: same check at their write/read entry points.
- Credits: `add_credits` / top-up and credit-activity paths check the `credits` entitlement; the existing credit reservation gate additionally refuses when the resolved payer has no `ai_generation`/`credits` entitlement.
- Connections: creating a connection checks `connect_schools` / `connect_teachers` / `connect_parents` — this is what stops Parent Free from making a direct teacher connection.
- Limits: class creation checks `max_classes`, roster/invite paths check `max_students`, both enforced in the database (trigger) as well as in the server function, with the exact messages from the brief.

## 5. Admin → Plans UI

Extend the existing `PlanDashboard` (money split, versions, publish flow untouched) with a new **Entitlements** section per plan:

```text
TEACHER FREE                          [ Published v3 ]
Teaching              Assessment & Progress
[x] Personal Workspace  [ ] Progress Tracking
[x] Community           [ ] Reports
[x] Community Notes     [ ] Advanced Assessment
[ ] Create Lesson Notes
[x] SmartBoard        AI & Usage
[x] Classes             [ ] AI Generation
[ ] Assignments         [ ] Credits
[ ] Adventure           [ ] Cloud Storage / Export

Limits   Max classes [ 1 ]   Max students [ 5 ]   (blank = unlimited)
Connections  [x] Schools  [x] Parents  [ ] Direct teacher access
```

Grouped toggles, saved through one admin server function, driven entirely by the catalogue table so a new feature is a row insert, not a UI rewrite. Categories irrelevant to a plan's audience are hidden.

## 6. Customer-facing surfaces

Plan cards on the pricing page and the plan gateway show the resolved entitlement list (generated from the toggles) alongside the written description, so what is advertised cannot drift from what is enforced.

## Notes

- All schema work is additive migrations with GRANTs and RLS (public read for the catalogue and plan entitlements, platform-owner writes only).
- No unrelated pages are redesigned; existing plan, subscription, connection, credit and workspace structures are reused.
- Rollout order: migration + seed → resolver → hook/gates → server enforcement per feature area → admin UI → customer plan cards.
