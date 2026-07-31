# My Test Accounts: One of Each Role, Owned by You

You keep one Platform Owner account, plus four accounts of your own — a School, a Teacher, a Parent and a Student — created and owned by you for testing. You open any of them from the Platform console with no login. Every other customer account is listed but locked: opening it asks for that customer's email and password, which you don't have.

## 1. Your four accounts

A one-time setup creates, if they don't already exist:

| Account | Sign-in email | Opens |
| --- | --- | --- |
| My School | onoberhiefaith1+school@gmail.com | School dashboard (teachers, classes, reports, subscription) |
| My Teacher | onoberhiefaith1+teacher@gmail.com | Teaching Hub (lesson notes, smartboard, classes, reports) |
| My Parent | onoberhiefaith1+parent@gmail.com | Family dashboard (children, linked teachers, reports) |
| My Student | onoberhiefaith1+student@gmail.com | Join Class + student classroom |

Plus-aliases are used because every account needs its own sign-in address; all four still deliver to your inbox, and you can change any of them later.

These are genuinely separate accounts. A lesson note you write in My Teacher never appears in My School. Teachers you add in My School never appear in the Platform console lists as your own data — the Platform console stays account/subscription information only. That separation already holds today because each account is a distinct login; nothing is shared but your ownership of them.

## 2. Platform console behaviour

Each tab (Schools / Teachers / Parents / Students) lists **every** account on the platform, as now. What changes is the action column:

- Rows that are yours show a gold **Mine** badge and an active **Enter workspace** button — one click, no login.
- Every other row shows **Enter workspace** in a locked state. Clicking it opens a small "Sign in as this account" box asking for that customer's email and password. Without their credentials, nothing opens. No magic-link bypass for accounts that aren't yours.
- Preview, Suspend/Reactivate and Delete stay available on all rows, as today (management data only, never their lesson content).

A new **My accounts** strip sits at the top of the console: four cards (School, Teacher, Parent, Student) that jump straight into your own workspaces. If one is missing, the card reads "Create" and makes it on the spot.

## 3. Exiting

The existing purple exit banner keeps working: while you're inside one of your test workspaces it stays on screen, and "Exit workspace" drops you straight back into the Platform console as the owner.

## Technical section

**Ownership marker (one additive migration)**
- New table `platform_test_accounts (id, owner_user_id, target_user_id unique, role, created_at)` with GRANTs (`authenticated` select, `service_role` all), RLS scoped to `owner_user_id = auth.uid()`.
- No changes to `user_roles`, `organizations`, `account_memberships`, `classes`, `notebooks` or any existing RLS.

**Server (`platformAdmin.server.ts` + `platform.functions.ts`)**
- `ensureMyAccounts()` — idempotent: for each of the four roles, create the auth user (`email_confirm: true`, generated password), insert `user_roles`, create the owning `organizations` row for the school, upsert `profiles.display_name` ("My School" etc.), and record the row in `platform_test_accounts`. Reuses an existing user when the alias is already registered.
- `fetchMyAccounts()` — returns the four rows (role, userId, email, name, exists).
- `platformAccounts()` gains `isMine: boolean` per row, from `platform_test_accounts`.
- `enterWorkspace` is tightened: it mints a magic-link token **only** when `target_user_id` is in the caller's `platform_test_accounts` (or the caller's own id). Any other target returns `{ requiresCredentials: true }` instead of a token. Audit row in `admin_impersonation_log` unchanged.

**Frontend**
- `AdminConsole.tsx`: `MyAccountsStrip` above the stat cards; `Mine` badge; locked Enter-workspace path opens `CredentialEntryDialog`.
- New `src/components/accounts/CredentialEntryDialog.tsx`: email + password, calls `supabase.auth.signInWithPassword` after parking the owner session via the existing `impersonation.ts` helpers, then navigates to that role's home.
- `impersonation.ts` gains `beginImpersonationWithCredentials()` reusing the same park/restore logic.
