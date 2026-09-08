## Technical detail

**New `src/lib/auth/sessionReset.ts`** — one exported `resetAccountState(queryClient)` that:
- `await queryClient.cancelQueries()` then `queryClient.clear()` (stops in-flight protected fetches before they 401, drops all cached account/workspace/roster data).
- Clears in-memory caches: `clearWorkspaceScopeCache()`, and the module store in `src/lib/stability/appContext.ts` (add a `resetAppContext()` export) plus its `mathgpl:app-context` sessionStorage entry.
- Removes per-account browser keys: `mathgpl:dashboard-bg` (`dashboardBackground.ts` STORAGE_KEY), `mathgpl:returnTo`, and the impersonation keys in `impersonation.ts`.
- Exported `signOutCompletely(queryClient, navigate)`: reset first, then `supabase.auth.signOut()`, then `navigate("/login", { replace: true })`.

**`AuthProvider.tsx`** — track the previous `user.id`. In the `onAuthStateChange` handler, when the incoming user id differs from the previous one (including `SIGNED_OUT` → null), run `resetAccountState` and hold a `switching` flag; render a neutral "Signing out…" screen while it is true, so no component paints with the outgoing account's data. Only `TOKEN_REFRESHED`/same-id events pass through untouched. `AuthProvider` needs `useQueryClient()`, which is already above it in `__root.tsx`.

**Call sites** — `AccountMenu.tsx`, `AcademyTopBar.tsx`, `src/pages/Index.tsx` and `impersonation.ts` (its stop path) all call `signOutCompletely` instead of `supabase.auth.signOut()` directly.

**Identity-scoped query keys** — add the user id to the keys most likely to bleed: `["account"]` → `["account", userId]` in `useAccount.ts`, and `["workspaces"]` → `["workspaces", userId]` in `useWorkspace.ts`. This makes cross-account reuse structurally impossible even if a wipe is ever missed.

**Session lifetime** — the login form already stores `mathgpl:remember`. Wire it to Supabase storage choice: remembered sign-ins persist as now; unremembered ones live in `sessionStorage` so closing the tab or browser ends them. Implemented in a small storage adapter, without touching the generated Supabase client file.

**Verification** — sign in as one account, sign out, sign in as a second account in the same tab without refreshing, and confirm the name, role, dashboard and lists are the second account's from the first paint; then confirm Back cannot restore the first account's pages.
