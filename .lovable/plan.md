# Restore visible asset-manager editing (without opening it to everyone)

## What is actually happening

The editing controls were not removed. The permission check behind them
(`can_manage_gpl_assets`) is returning **false** for the account currently signed in to
the preview: `onoberhiefaith1+teacher@gmail.com` (teacher test account, signed in 04:31).
Management is granted only to the platform-owner account
(`onoberhiefaith1@gmail.com`) or to an account holding an active `asset_manager` staff
code. So the library is correctly read-only for the teacher account — but there is no way
to tell that from the screen, and no in-app way to give a second account manager rights.

## What will change

1. **Owner-controlled Manager access**
   A small "Asset managers" area inside the existing platform admin console where the
   owner can grant or revoke asset-manager rights per account (by email / account ID).
   Grants are stored server-side; revoking removes editing everywhere instantly.
   The owner and co-admins always have manager rights.

2. **A visible read-only signal on the asset pages**
   On `/assets` and each category/sub-session page, non-managers see one quiet line:
   "Read-only library — sign in with a manager account to add or edit assets."
   Managers see the existing Add Session / Add Sub-Session / Add Asset buttons unchanged.

3. **No loosening of end-user permissions**
   Students, parents, teachers and schools without a grant keep exactly today's
   use-only experience: browse, insert, copy — no create, edit, deactivate or delete.

## Technical notes

- Migration (additive): update `public.can_manage_gpl_assets()` to also return true for
  `has_role(auth.uid(), 'co_admin')` and for an active row in a new
  `public.gpl_asset_managers` table (`user_id`, `granted_by`, `created_at`,
  `revoked_at`). Table gets `GRANT SELECT` to `authenticated`, `GRANT ALL` to
  `service_role`, RLS on, owner/co-admin-only management policies, and a self-read
  policy. Existing owner + `staff_codes` branches stay intact, so nothing currently
  working is lost.
- The RLS policies on `gpl_asset_sessions` / `gpl_asset_subsessions` / `gpl_assets`
  already call `can_manage_gpl_assets()`, so server-side enforcement follows
  automatically — the client flag is only for showing controls.
- `src/lib/gpl/useAssetManager.ts`: expose `checked` usage so pages can render the
  read-only note only after the session check resolves (avoids a flash).
- `src/pages/Assets.tsx`, `src/pages/AssetCategory.tsx`,
  `src/components/assets/manage/OfficialAssetSection.tsx`: add the read-only line for
  non-managers; leave manager branches untouched.
- New admin panel under the existing platform console route, reading/writing
  `gpl_asset_managers` through an authenticated server function that verifies
  owner/co-admin role before any write.

## Verification

- Signed in as owner: Add Session / Add Sub-Session / Add Asset all present on
  `/assets` and `/assets/emoji`.
- Grant the teacher test account manager rights from the console, reload: the same
  controls appear for it; revoke, reload: they disappear and a direct write is rejected
  by the database.
- Signed in as a student: no management controls, read-only note visible.
