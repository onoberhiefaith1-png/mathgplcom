## Technical notes

**Staged migration** (applies when this draft is accepted, additive only):

- New table `public.asset_managers` (`user_id` unique, `granted_by`, `granted_at`, `note`), with GRANTs (`SELECT` to `authenticated`, `ALL` to `service_role`), RLS enabled, and read/write policies limited to `has_role(auth.uid(),'platform_owner')` plus self-read.
- `CREATE OR REPLACE FUNCTION public.can_manage_gpl_assets()` extended to:
  `platform_owner` OR `co_admin` OR row in `asset_managers` OR the existing live `staff_codes` asset-manager claim. Same signature, `SECURITY DEFINER`, `search_path = public`, so all existing GPL RLS policies keep working unchanged.
- A seed `INSERT` that grants the currently code-claimed manager account a permanent row, so nothing depends on the code afterwards.

**Owner panel** — `src/pages/admin/AccessCodesPage.tsx` gains an "Asset managers" card (or a sibling page) backed by a new `src/lib/gpl/assetManagers.functions.ts` server function pair: `listAssetManagers` and `setAssetManager({ email, enabled })`, both `.middleware([requireSupabaseAuth])`, verifying `platform_owner` through `context.supabase` before using the admin client to resolve the email to a user id.

**Client resilience** — `src/lib/gpl/useAssetManager.ts`: keep the cached `true` answer instead of resetting to `false` while a re-check is in flight, re-evaluate on `visibilitychange`/`focus`, and expose `checked` so pages render nothing (not read-only) until the answer is known.

**Status chip** — `src/pages/Assets.tsx` and `src/pages/AssetCategory.tsx` show a small chip: "Managing library" when manager, "Read-only" otherwise, so the state is always visible rather than inferred from missing buttons.

**Personal library** — `src/lib/lessonnotes/assets/customAssets.ts` already scopes to `owner_id`; the audit is limited to confirming the My Assets UI never gates its own save/delete controls behind `isManager`.
