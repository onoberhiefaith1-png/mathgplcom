# Fix account carry-over after sign-out, and add 15-minute idle sign-out

## What is going wrong

When someone signs out and another person signs in on the same browser, the first screens still show the previous person's account. This is not a permissions leak in the database — the sign-in is correct, but the app keeps a memory of the previous account and shows it again.

Two causes were confirmed in the code:

1. **Nothing clears the app's in-memory data when someone signs out.** No sign-out path anywhere in the app empties the shared data cache. There are five sign-out buttons (Account menu, top bar, home page, lesson notes, exit-workspace) and each one only ends the session.

2. **Much of the cached data is not labelled with who it belongs to.** The account record itself is stored under a plain "account" label with a 5-minute freshness window, so the next person to sign in within 5 minutes is handed the previous person's role, workspace and permissions. The same applies to workspaces, community profile, plan, gateway and similar records.

There is also a smaller version of the same problem in browser storage: the dashboard background is saved under one shared key with no account attached, so the new person briefly sees the previous person's background.

## The fix

**1. One shared sign-out routine, used by every sign-out button**

Cancel anything still loading, empty the whole data cache, clear the account-specific browser keys, end the session, then send the person to the sign-in page (replacing history so Back cannot restore the previous account's screens).

**2. Clear on sign-in too, not just sign-out**

A person can arrive already signed in as someone else (session restored, or a switch). The single session listener will compare the incoming account with the one it was holding; whenever the identity changes, it empties the cache before any screen reads it. This closes the case where the browser was closed without signing out.

**3. Label per-account data with the account**

Every cached record that belongs to one person gets that person's id in its label, starting with the account/role record, workspaces, community profile, plan, gateway and profile summary. Then stale data from another account can never be matched and reused.

**4. Account-scoped browser storage**

The dashboard background key (and any similar per-account key) becomes account-specific, and the shared key is removed on sign-out.

**5. Automatic sign-out after 15 minutes of inactivity**

A small idle watcher in the app root:
- counts pointer, keyboard, touch, scroll and visibility activity as "active";
- after 15 minutes with no activity, runs the same shared sign-out routine and lands on the sign-in page with a short "You were signed out after 15 minutes of inactivity" message;
- stores the last-activity time so a browser left closed/backgrounded past the limit is signed out on return;
- shares the countdown across tabs, so activity in one tab keeps all tabs alive;
- shows a warning about a minute before, with a "Stay signed in" button;
- excludes the public pages (shared challenge/smart card links and guest flows) — those have no account to sign out of.

## Verification

Sign in as teacher A, sign out, sign in as teacher B, and confirm the dashboard, name, role and workspace are B's immediately. Repeat teacher → student and student → student. Then leave a signed-in tab untouched and confirm the sign-out happens and re-entry requires signing in.

## Technical notes

- New `src/lib/auth/signOutEverywhere.ts`: `cancelQueries()` → `queryClient.clear()` → remove account-scoped local keys → `supabase.auth.signOut()` → navigate to `/login` with `replace: true`. All five call sites switch to it.
- `AuthProvider`: keep a `lastUserId` ref; on `onAuthStateChange`, when `session?.user.id` differs from it, call `queryClient.clear()`. Requires the provider to sit inside the QueryClientProvider (verify ordering in the root route).
- Query keys to scope: `["account"]` (`useAccount.ts`), `["workspaces"]` (`useWorkspace.ts`), `["community", ...]`, `["my-plan"]`, `["credit-options"]`, `["gateway-*"]`, `["notifications", ...]`. Pattern already used correctly by `useUsername`/`useProfileSummary` (`user?.id ?? "anon"`).
- `dashboardBackground.ts`: key becomes `mathgpl.dashboardBackground:<userId>`.
- New `src/lib/auth/useIdleSignOut.ts` mounted once in `__root`: 15-minute timeout, `mathgpl.lastActivity` in localStorage plus a `storage` listener for cross-tab sync, 60-second warning toast, skipped on public/guest routes.
- Impersonation "exit workspace" keeps its own restore path (it must not clear the parked owner session) but gains the cache clear.
