# Account System & Authentication Redesign

One sign-in for the whole platform, one Account menu as the front door, and a tailored registration flow and dashboard per role. Builds on the role foundation already in place (`user_roles`, `organizations`, `account_memberships`, `role_capabilities`, `ensure_account`, `/home` dispatcher).

## 1. Account menu replaces Login / Sign Up

The top-right of the academy header currently shows one "Login / Sign Up" link. It becomes a single **Account** dropdown listing:

- Platform Administrator
- School Account
- Teacher Account
- Parent Account
- Student Account

Each entry opens `/auth/<role>` — the same authentication engine, a role-specific page (heading, colour accent, and the correct registration fields). Signed-in users see their name instead, with links to their dashboard and Sign out.

## 2. Role-specific auth pages

Routes: `/auth/admin`, `/auth/school`, `/auth/teacher`, `/auth/parent`, `/auth/student`. `/auth` stays as a neutral chooser so every existing link keeps working.

Each page provides Sign in, Create account, Forgot password, plus Google sign-in. Email verification is handled by the existing confirmation email; a new `/auth/reset-password` page completes the reset link (this page does not exist today and is required for resets to work).

Platform Administrator has sign-in only — no self-registration. Co-administrators are invited from the admin console; that invite screen is listed in "Later phases".

## 3. Registration fields

Everyone: First name, Last name, Email, Password, Confirm password, Country, Time zone (auto-detected, editable).

- Student: + Date of birth (stored privately, never rendered publicly; used for age-appropriate content).
- School: + School name, School type, Website (optional).
- Teacher: + Display name, Subjects taught (optional), School (optional).
- Parent: + Display name, Number of children (optional).

Every form requires an explicit checkbox accepting the Terms of Service and Privacy Policy, plus a separate optional opt-in for product and newsletter emails. Security and account emails always send.

## 4. Single sign-on across the platform

Today each feature page runs its own sign-in check and can bounce a signed-in user to `/auth` while the session is still being restored (this is the cause of "Lesson Notes asks me to log in again"). Replace those scattered checks with one shared auth provider:

- One session listener at the app root; pages read the session from context instead of calling Supabase themselves.
- A single route guard that waits for the session to resolve before deciding, so a valid session never triggers a redirect.
- When a guard does redirect, it remembers the exact destination and returns the user there after sign-in.

Applies to Lesson Notes, SmartBoard, Teaching Hub, Classes, Assignments, Adventure, Gallery, Reports and Settings.

"Remember me" keeps the session persisted (current default); unchecking it limits the session to the browser tab.

## 5. Public challenge exception

`/c/:slug` Smart Card and Game Challenge pages stay fully public. Their existing "sign in to start the challenge" flow is unchanged and stays separate from the platform login.

## 6. Terms of Service and Privacy Policy

New public pages `/terms` and `/privacy`, styled with the existing academy design system, covering exactly the principles listed: educational purpose, user-generated content responsibility, prohibited content, resource sharing, teacher–student relationships, independent financial arrangements outside the platform, privacy (what is collected, why, how protected, how to delete), and email communications.

I will draft these from your wording. I need from you: the legal entity name, a contact email for privacy requests, and the governing country/jurisdiction. Until you provide them the pages carry clear placeholders rather than invented facts.

## Technical notes

**Migration (additive):** extend `profiles` with `first_name`, `last_name`, `country`, `time_zone`, `date_of_birth`, `marketing_opt_in`, `terms_accepted_at`; add `organizations.school_type` and `website`; add a `teacher_profile` detail column set (subjects, school name). A signup trigger copies the sign-up metadata into these columns so nothing depends on client writes.

**App code:**
- `src/lib/auth/AuthProvider.tsx` — single session context + `useAuth()`.
- `src/components/auth/RequireAuth.tsx` — the one guard; removes the per-page `onAuthStateChange` + redirect blocks.
- `src/components/academy/AccountMenu.tsx` — replaces the header link.
- `src/pages/auth/RoleAuthPage.tsx` — one component driven by a per-role field config in `src/lib/accounts/authForms.ts`; role routes under `src/routes/auth/`.
- `src/pages/auth/ResetPasswordPage.tsx` at `/auth/reset-password`.
- `src/pages/legal/Terms.tsx`, `src/pages/legal/Privacy.tsx`.
- Zod validation on every form (length limits, email, password confirmation, date-of-birth sanity).

## Later phases

Co-administrator invites and permission assignment, school/parent account management CRUD, billing, and age-based content personalisation using the stored date of birth.
