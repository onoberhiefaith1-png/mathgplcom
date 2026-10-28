# Pricing-gateway bypass for your four test accounts

Your four personal test accounts (School, Teacher, Parent, Student — the ones listed under "My accounts" on the admin console) should never be sent to the pricing gateway. Everyone else keeps the gateway, except people who redeem an access code (that bypass already exists).

## What changes

- The four accounts are recognised as free-access accounts, exactly like access-code holders: no pricing gateway redirect, full feature access, no subscription needed.
- No other account is affected. Anyone not in that list and without an access code still goes through the gateway.
- The bypass is defined by the existing test-account records owned by you (confirmed: exactly 4 rows, one per role), so it stays automatic if you ever swap a test account — no hardcoded emails.
- The pricing/plan area on those accounts shows a quiet "Test account — full access" note instead of plan choices.

## Technical notes

- Migration (additive): extend `public.has_free_access(_user_id)` so it also returns true when the user appears as a `target_user_id` in `platform_test_accounts` whose owner holds the `platform_owner` role. `effective_entitlements` and `has_entitlement` already call `has_free_access`, so server-side feature access unlocks with no further change.
- `fetchMyPlan` (`src/lib/plans/plans.functions.ts`) additionally returns `freeAccess` by calling the `has_free_access` RPC with the authenticated context.
- `usePlanGate` (`src/lib/plans/usePlanGate.ts`) exposes `freeAccess` and forces `needsPlan: false` when it is true; `src/pages/Index.tsx` then stops redirecting to `/plans/gateway`.
- `PlanSection.tsx` and `PlanGatewayPage.tsx` render the free-access notice when `freeAccess` is set, instead of the plan picker.
- Nothing about credits, plans, or the gateway for normal accounts is modified.
