# Secret entrance: invitation-only free access

A hidden door at the bottom of the public homepage lets selected people sign in with an ID, a password and a one-person access code you generate. Those people get the full system without a subscription. Nothing about the normal login, the plans, or the Admin console changes.

## What you get

1. **The dots.** At the very bottom of the public homepage, a bare `•••` — no box, no button outline, low contrast, no label. Clicking it opens the secret login screen at `/access`. It is not linked anywhere else and is not listed for search engines.

2. **The secret login screen.** Three fields: MathGPL ID, Password, Access Code. It reuses the same ID-and-password sign-in the normal login uses, then checks the code. If the ID and password are right but the code is wrong, disabled, or already belongs to someone else, the sign-in is refused with one neutral message ("That combination is not recognised") and the person stays out.

3. **One code, one person.** A code is unclaimed until it is first used successfully. At that moment it locks to that account forever. Any second person entering the same code is refused, and the true owner can keep re-entering it as often as they like.

4. **Admin control panel** — a new "Access Codes" page in the Platform Console. You can:
   - Generate a code (a short random code, optional note such as "Mrs Ade — St Mary's", optional expiry)
   - See at a glance: the code, the note, whether it is Unclaimed / Claimed, who claimed it, when, whether it is Active or Disabled
   - Disable a code (the person loses free access immediately) and re-enable it
   - Delete a code outright

5. **What the access grants.** The holder keeps their own account type. Every paid feature of that account type is unlocked without a subscription — a School account works without subscribing, a Teacher account gets the paid tier — and their AI usage is carried by the platform instead of their own credits. Free-access holders see no billing prompts or upgrade walls.

6. **What it never grants.** No administrative role, no Platform Console, no admin controls, no ability to generate access codes. The Admin area stays exactly as it is and the Admin account is untouched.

7. **Unchanged.** Public signup, the normal login, Teacher Free mode, School subscription gating, plans and pricing — all exactly as today. The secret entrance is a parallel route, not a replacement.

## Technical section

**Database (additive only).** The project already has `staff_codes` + `staff_redemptions`, which the credit engine already honours as a free-usage exemption. Extend rather than duplicate:
- `staff_codes`: add `purpose text default 'access'`, `claimed_by uuid`, `claimed_at timestamptz`, `revoked_at timestamptz`.
- Add a partial unique index on `staff_redemptions (code_id) WHERE active` so one active code can never serve two people.
- New security-definer function `redeem_access_code(_code text)`: validates active + not expired + (unclaimed OR claimed by caller), then claims it, ensures the caller's cost unit and writes the redemption. Returns a plain outcome. `EXECUTE` to `authenticated` only.
- New function `has_free_access(_user_id uuid)`: true when the user holds an active, non-expired, non-revoked claimed code.
- `has_entitlement` and `effective_entitlements` gain `OR public.has_free_access(_user_id)` so every existing server-side and client-side gate unlocks with no per-feature work. `has_role`, `has_capability` and the admin guards are deliberately left alone — that is the wall keeping the Admin area separate.
- Admin management runs through `service_role` in server functions; no new client-writable table policies.

**Server functions.**
- `src/lib/access/access.functions.ts` — `signInWithAccessCode` (unauthenticated: signs in by ID + password through the existing `accountId.functions.ts` path, calls `redeem_access_code` with that new session, signs the user back out and returns a neutral failure if the code is rejected) and `myFreeAccess`.
- `src/lib/access/accessAdmin.server.ts` + admin server functions guarded by `assertPlatformAdmin`: `listAccessCodes`, `generateAccessCode`, `setAccessCodeActive`, `deleteAccessCode`.

**Frontend.**
- `src/routes/access.tsx` + `src/pages/access/SecretAccessPage.tsx` — the three-field screen, deliberately plain, `noindex`.
- `src/components/site/SecretEntranceDots.tsx` rendered at the end of `WelcomePage.tsx` (both the CMS-driven and fallback branches).
- `src/routes/admin/access-codes/index.tsx` + `src/pages/admin/AccessCodesPage.tsx` in the existing gold Platform Console shell, linked from the admin index.
- Post-login the holder lands on the homepage and enters their own workspace exactly as any other account, via the existing `WORKSPACE_PATH` map.
