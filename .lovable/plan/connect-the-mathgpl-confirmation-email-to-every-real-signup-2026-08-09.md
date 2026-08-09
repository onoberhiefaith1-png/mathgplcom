# Connect the MathGPL confirmation email to every real signup

## What I verified first

- Every signup path (the 4-step `/signup` flow and the per-role `/auth/:role` pages) already calls the one real authentication system — no second auth system exists, and school signup uses the exact same call as student/teacher/parent.
- The MathGPL-branded "Confirm Your Account" email and its auth webhook already exist and are correctly wired to the verified `notify.mathgpl.com` sender.
- The email log table has **zero rows ever** — no auth email has ever been enqueued. The email queue itself is healthy.
- Auth logs show a live signup attempt returning success and a later login failing with invalid credentials, i.e. the account was created but never confirmed.

## Root cause

The branded auth email route lives in this project's server code and only becomes live for the real site when the app is **published**. The templates and webhook were added after the last publish, so the live site at mathgpl.com has no route to receive the auth email event — the account is created, no email is ever enqueued, and the user is left unable to log in.

So the missing connection is a deployment step plus the missing user-facing verification states. No template, design, or auth system changes.

## What I'll do

1. **Publish so the live auth email route exists.** Nothing else can send the confirmation email until this route is live. I'll confirm afterwards that a real signup produces an email log row and reaches the inbox.

2. **Post-signup screen (all roles, including School).** The 4-step signup already advances to a final step; I'll make that step state clearly:
   - "Account created successfully."
   - "Please check your email to confirm your MathGPL account."
   - the exact email address entered, shown back to the user
   - a working "Resend confirmation email" action

3. **Resend confirmation.** Uses the authentication provider's own resend for the signup confirmation — same real token, same existing branded email. Client-side cooldown (60s) plus the provider's own hourly limit; success and "please wait" messages shown inline. Same action reused on the login page.

4. **Login behaviour for unverified users.** Instead of a generic failure, an unverified sign-in shows "Please confirm your email address before signing in." with a "Resend confirmation email" button beside it. Applies to both the unified login page and the per-role auth pages, so School behaves identically to the others.

5. **Verification landing.** The confirmation link already lands on the existing verified page; I'll make sure it then routes the user into the normal role dispatch so a School account lands on its school dashboard, and the profile created at signup is untouched.

6. **Password reset check.** Trace the Forgot password action end to end: real reset request → existing branded reset email → existing reset-password screen → new password saved → login with the new password. Fix only what's broken in that chain.

7. **Test the full sequence** on the live site: School signup → email arrives → confirm → log in → School Dashboard; resend produces a fresh working link; password reset completes.

## Technical notes

- Nothing in the email templates, the shared email shell, or the auth webhook is redesigned.
- Email verification stays required; no auto-confirm, no fabricated tokens, no hard-coded links, no tokens stored in app tables, no passwords in email.
- Changes are limited to: the signup page's final step, the login pages' error handling, one small shared resend helper, and the verified-page redirect.
- I will not raise the provider's hourly auth-email limit unless testing shows real signups hitting it.
