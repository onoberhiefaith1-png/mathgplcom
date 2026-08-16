# Unlimited test accounts + a Back button on the plan gateway

Two small changes.

## 1. Your four accounts get full, unlimited access

Your School, Teacher, Parent and Student test accounts already skip the pricing gateway and already have every feature unlocked. What still blocks them are the **plan caps** — that's why creating a second class showed "your plan allows 1 class(es)".

Change: any account recorded as one of your test accounts is treated as having no caps at all — unlimited classes, unlimited students per class, and no other plan limit. Same for access-code holders, which already share the free-access rule.

Credits are untouched: usage still meters against your own credit balance exactly as it does today, so nothing is spent silently and nothing is free that shouldn't be.

The plan area on those accounts keeps showing the existing quiet "Test account — full access" note instead of plan cards.

## 2. Back button on the plan gateway

The "Choose your plan" screen gets a Back button at the top left, so you can leave it and return to the page you came from (falling back to your own homepage). It uses the app's standard Back behaviour, so it walks the real navigation stack rather than the raw browser history.

## Technical notes

- **Migration (additive, one function replaced):** `public.effective_limit(_user_id, _limit)` returns `NULL` (meaning "no cap") when `public.has_free_access(_user_id)` is true, before it looks at subscription or plan limits. Both cap triggers (`enforce_class_limit`, `enforce_class_student_limit`) already treat `NULL` as unlimited, so they need no edit. No table, grant or RLS change.
- **`src/pages/plans/PlanGatewayPage.tsx`:** add the shared `BackButton` (`@/components/common/BackButton`) in the header with `fallback` set to the role's `WORKSPACE_PATH` (or `/` when the role isn't known yet). No change to plan selection, checkout or the free-access notice.
