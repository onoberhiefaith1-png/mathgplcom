## Technical notes

Confirmed by reading the code and the database:

- `public.has_free_access` already returns true for platform owner, co-admin, active `staff_codes` holders and rows in `platform_test_accounts`. `effective_entitlements`, `has_entitlement` and `effective_limit` all honour it.
- The database confirms `+school`, `+teacher`, `+parent`, `+student` are `platform_test_accounts` rows; the teacher also carries a `free:active` subscription.
- `src/lib/homepage/useBuildingContext.ts` computes `onFreeTerms` from `subscription` alone (`!subscription || price <= 0 || /free/i.test(planKey)`) and never reads `freeAccess` from `usePlanGate()`, which is why all four accounts and every access-code holder resolve to `platform-free` with `canCustomize: false`.
- `can_edit_building` / `can_view_building` are ownership-based and already correct — no migration is needed for the Academy building editor.
- `useHomepageConfig().save` writes `profiles.homepage_config` for the signed-in account (or the platform config via RPC for owners), so there is no server-side plan gate to relax.

Changes:

1. `src/lib/homepage/useBuildingContext.ts` — pull `freeAccess` out of `usePlanGate()` and treat it as paid: `const fullAccess = freeAccess || isPlatformOwner`. Compute `freePlan` only when `subscribes && !fullAccess && onFreeTerms`. Keep the `community` and `visitingSharedWorkspace` branches exactly as they are. For the final branch, return `configMode: "self"` and `canCustomize: true`, keeping the existing student/shared-workspace read-only fallback but allowing a `fullAccess` student in their own personal workspace.
2. `src/components/homepage/HomepageSettingsButton.tsx` — replace the blanket `role === "student"` early return with one that keeps students out unless they hold full access and are in their own personal workspace. Leave the signed-out and shared-workspace guards untouched, and keep the `canCustomize || canManageAds` gate as the single source of truth.
3. Add a unit test around the resolver logic covering: free-access teacher/parent/school/student with no subscription, access-code teacher on a `free:active` subscription, genuinely unpaid free teacher (still `platform-free`, still ad-bearing), student inside a school workspace (read-only), and Community (always the advert building).

Verification: `bunx tsgo --noEmit`, the new tests, then an authenticated pass at 1280x1800 signing in as the teacher test account to confirm the Settings gear appears and Replace Building opens, and a check that the free-only path still shows the advert building.
