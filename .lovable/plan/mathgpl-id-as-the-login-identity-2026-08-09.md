# MathGPL ID as the login identity

Every account gets one permanent MathGPL ID and logs in with **ID + password**. Email stays for messages, confirmation and recovery only. No Google sign-in on the MathGPL login. The rotating building still comes first, then the role environment, then the page.

## The ID system

A new server-side registry issues one ID per account, once, and never reuses a number:

| Account | Format |
|---|---|
| Administrator | `ADM/000001` |
| School | `SC/OX/000001` |
| Teacher | `TCH/000001` |
| Student | `STU/000001` |
| Parent | `PAR/000001` |

- Numbers come from a database sequence inside the creating transaction, so two accounts can never collide, and the ID is locked once issued.
- School acronym is derived from the school name (Oxford Academy -> OX), de-duplicated when taken (OX2), and the administrator can correct it before it is used.
- Existing accounts are reissued in the new format by role. The old `MGP-` student codes stop being used for login or display.
- Nobody types their own ID; it is always generated.

## Logging in

The login form becomes **MathGPL ID** + **Password**, with an eye button on the password. Email in that field is not accepted.

Sign-in works like this: the browser sends the ID and password together to the server, the server looks up which account owns that ID, verifies the password, and returns a session only on success. The ID alone never reveals an email or whether an account exists, and the role that grants access is read from the server, never from anything the browser claims.

Signup keeps the four public account types (Student, Teacher, School, Parent). There is no public Administrator signup. After signing up the person is shown their new MathGPL ID and told to log in with it.

## Administrator

- One administrator account, ID `ADM/000001`, permanent, not obtainable through public signup.
- New **Account & Security** area in the administrator environment showing account type, MathGPL ID and email, plus **Create password** (password + confirm) the first time and **Change password** after that. The password is never displayed back.
- Administrator environment navigation: **Administration** (the existing administrator page — not duplicated), Accounts, Community, Security, System settings. **No Teaching Hub.**
- The administrator's teacher identity stays a separate environment. All existing lesson notes and teaching content remain owned by that teacher account and appear when entering the teacher environment. Nothing is moved or merged.

## Each role after login

Login -> building -> environment, in every case:

```text
ADM/000001  -> universal building -> Administration
SC/OX/000001 -> school building   -> School Administration   (no Teaching Hub)
TCH/000001  -> teacher building   -> Teaching Hub
STU/000001  -> student building   -> Student Workspace
PAR/000001  -> parent building    -> Parent Workspace
```

Every role gets an Account & Security area showing name, MathGPL ID, account type and email, with Change Password (new + confirm). School manages teachers and students only; the administrator manages schools, teachers, students and parents. Existing relationships and permissions are untouched.

## Emails

The existing branded MathGPL emails stay exactly as designed. New-account emails gain the person's MathGPL ID and say to log in with that ID and their password — never "log in with your email". Greeting stays first-name only. Passwords never appear in an email.

## Technical notes

- New `public.account_ids` table: `user_id`/`org_id`, role prefix, sequence number, formatted `mathgpl_id` (unique, immutable via trigger), school acronym. Per-role `BIGSERIAL` sequences. Issued by a `SECURITY DEFINER` function called from the signup trigger and from administrator-side account creation. Grants + RLS: a user reads their own row; the administrator reads all.
- Backfill migration assigns IDs to all existing accounts by their `user_roles` role, ordered by creation date, in one transaction. No rows are deleted; `profiles.mathgpl_student_id` is retained in the database but no longer surfaced.
- Login: a public `createServerFn` takes `{ mathgplId, password }`, resolves the auth email with the service-role client, verifies the password with a publishable-key client, and returns the session for `supabase.auth.setSession`. Uniform error text for unknown ID and wrong password; per-IP/ID attempt throttling.
- Remove the Google button and `lovable.auth.signInWithOAuth` call from `LoginPage.tsx` and `RoleAuthPage.tsx`. The Gmail/transactional email system, webhook routes and templates are untouched.
- Password changes use `supabase.auth.updateUser` from the authenticated Account & Security screens; the administrator's first-time creation uses the same call.
- Role/environment gating stays server-derived (`user_roles`, `has_role`, existing RLS). Administrator navigation drops Teaching Hub via `roles.ts`; school navigation likewise.
- Reissued IDs and the ID-only login mean an existing account whose owner has not seen their new ID recovers it by email; a "Recover my MathGPL ID" link on the login page emails the ID to the address on file.

## Verification

Sign in as each of the five account types with ID + password, confirm the building renders first, the correct environment follows, the Account & Security area shows the right ID, a password change works, no Google button exists, no email login is accepted, the administrator has no Teaching Hub, and existing lesson notes still open in the teacher environment.
