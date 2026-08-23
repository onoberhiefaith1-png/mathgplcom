# Sign in / sign up should land on the homepage, not the pricing gateway

## What is happening

Signing in or completing sign-up sends the account to `/` as intended, but the homepage
itself immediately redirects teacher, school and parent accounts to the pricing gateway
whenever they have no active subscription and at least one plan is published for their
account type. Confirmed in the code:

- `src/pages/Index.tsx` runs `if (needsPlan) navigate("/plans/gateway", { replace: true })`.
- `needsPlan` in `src/lib/plans/usePlanGate.ts` is true for any teacher/school/parent
  without a subscription (and without free access) once plans exist for that audience.
- `src/pages/auth/VerifiedPage.tsx` also points the "continue" link at the gateway
  instead of the homepage after email confirmation.

So the login itself succeeds — the pricing page is a forced gate that fires straight after,
which contradicts the rule that every account lands on the Rotating Building homepage.

## The fix

1. Remove the forced gateway redirect from the homepage. Every signed-in account lands on
   the rotating building, exactly as intended.
2. Replace it with an invitation, not a wall: when `needsPlan` is true, show a calm banner
   on the homepage ("Choose your plan to unlock AI credits") with a link to
   `/plans/gateway`, dismissible for the session. Nothing else about the homepage changes.
3. Point the email-confirmation "continue" link in `VerifiedPage` at `/` for every account
   type, so a freshly confirmed account also opens the building.
4. Leave the pricing gateway page itself, plan selection, checkout and the existing
   credit/entitlement enforcement untouched — paid features stay gated where they already
   are; only the homepage detour goes away.

## Technical notes

- Files touched: `src/pages/Index.tsx` (drop the redirect effect, render the banner),
  `src/pages/auth/VerifiedPage.tsx` (destination), plus one small banner component under
  `src/components/plans/`.
- `usePlanGate` keeps returning `needsPlan`; it just drives a banner instead of navigation.
- No database, auth-config or server-function changes.
