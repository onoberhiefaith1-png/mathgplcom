# Fix account-role separation and protect the Admin account

## What I verified first

- Your Admin account (`onoberhiefaith1@gmail.com`) still holds the `platform_owner` role in the database. It was **not** converted to a teacher, and there is no duplicate account. So no account restoration is needed — the identity is intact.
- However, that same account also carries a stray extra `teacher` role row and a teacher workspace, created by an old automatic default.
- The real cause of "logging in opened the Teaching Hub" is a hard-coded fallback on the rotating-building homepage: the main entry button is `school → /school`, `parent → /family`, **everything else → /teaching-hub**. A platform owner (and a student) falls into the teacher branch.
- Two more automatic-teacher fallbacks exist:
  - the client sends `account_role ?? "teacher"` when resolving the account,
  - the database helpers `ensure_account` and `handle_new_user_account` end their role chain with `'teacher'`.
- Role-restricted areas (`/admin`, `/teaching-hub`, `/school`, `/student`, `/family`) currently have **no** role gate at all — only a sign-in check. Any signed-in user can open any of them by typing the URL.

## What will change

### 1. One authoritative role, no teacher fallback
- The signed-in account's role comes only from the stored role record (`account_role_of`, already priority-ordered with admin first). Remove the `?? "teacher"` request from the client so it can never suggest a role.
- Remove `'teacher'` as the last resort in the account-provisioning function and the new-user trigger. When no role can be determined, the account is left without a role instead of silently becoming a teacher.
- The app shows a clear "account configuration incomplete" screen for a roleless account rather than routing it anywhere.

### 2. Correct destination per role
- Replace the homepage's fallback chain with an explicit role → destination map (the existing `WORKSPACE_PATH`, currently defined but unused):
  - admin/co-admin → Admin Dashboard, teacher → Teaching Hub, school → School Console, parent → Parent Console, student → Student Workspace.
- The button label follows the same map, so an admin sees "Platform Console", never "Teaching Hub".

### 3. Real role gates on every workspace area
- Add a single role-guard component and apply it to the `/admin`, `/teaching-hub`, `/school`, `/student` and `/family` route trees. A wrong-role visitor gets a "not available for this account" screen and a link to their own workspace — never another account type's dashboard.
- Server-side enforcement stays where it already is: the database policies and role-checking functions decide what data a role may read or write, so a URL change alone can never grant access to another account type's data.

### 4. Membership never rewrites a role
- Audit and correct the join / accept / invite / connect paths so none of them insert or update a global role row. Workspace membership stays a relationship only.
- Add a database safeguard so ordinary application code cannot grant or remove `platform_owner` / `co_admin`; only the deliberate admin account-management operation can.

### 5. Clean up the Admin account
- Remove the leftover `teacher` role row from the Admin account (the `platform_owner` role, profile, data and workspace history are untouched). Its teacher workspace stays in place so nothing referencing it breaks; it is simply no longer what the account is.

### 6. Regression tests
Automated tests covering: each role lands on its own workspace; accepting a teacher/school/parent connection leaves the role unchanged; an admin entering a workspace stays admin; a wrong-role URL is refused; a roleless account never becomes a teacher.

No UI redesign — only the destination, labels, guards and role plumbing change.

## Technical notes

- Migration: drop `'teacher'` from the `COALESCE` chains in `public.ensure_account` and `public.handle_new_user_account`; add a trigger on `public.user_roles` blocking non-service changes to admin roles; delete the one stray `('646e35a6…', 'teacher')` row.
- Client: `src/lib/accounts/useAccount.ts` (drop the `"teacher"` request, expose a `roleMissing` state), `src/pages/Index.tsx` (use `WORKSPACE_PATH`), new `src/components/auth/RequireRole.tsx`, applied in the `admin` / `teaching-hub` / `school` / `student` / `family` route files.
- Audit targets for automatic role assignment: `src/lib/accounts/teamAdmin.server.ts`, `platformAdmin.server.ts`, `src/pages/auth/RoleAuthPage.tsx` (`signupRole ?? "teacher"`), and the connection/invitation RPCs.
