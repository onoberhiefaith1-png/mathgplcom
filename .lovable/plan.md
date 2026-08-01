# Authentication & Email System

Four connected parts: an owner-only Email Dashboard that every outgoing email flows through, a Welcome page, one Create Account flow, and one Login. The Rotating Building is never shown before sign-in.

## 1. Email Dashboard (owner only)

Reached from the platform console: Settings → System Settings → Email Dashboard. No other role can open it or see the link.

**Sender identity** — Sender name, Sender email, Reply-to. Stored as platform settings, not in code, so switching from a development sender to `accounts@mathgpl.com` later changes nothing else in the app.

**Connection panel** — shows one of: Connected, Not Connected, Awaiting DNS verification, Authentication failed, Invalid credentials, Daily sending limit reached. Includes the domain-setup entry point so you can attach `mathgpl.com` whenever you're ready. Until then emails send from the default MathGPL-branded sender, and the dashboard says so plainly.

**Send test email** — enter any address, receive a sample using the current sender and template styling, and see the result (sent / failed with reason) in the panel.

**Templates** — eight editable templates: Email Verification, Welcome, Password Reset, Class Invitation, Community Invitation, Assessment Notification, Announcement, General Notification. Each has an editable Subject, Body, Footer and Signature, a list of the placeholders it can use (name, link, class name, etc.), a **Preview** before saving, and Reset to default.

**One pipe** — a single internal send path reads sender settings plus the saved template. No feature sends email on its own, so future notifications inherit the configuration automatically.

## 2. Welcome page

`/` signed out shows only: logo, welcome message, **Create Account**, **Login**. No building, no dashboard, no navigation. Signed-in users at `/` get the Rotating Building exactly as today, so nothing changes once you're in.

## 3. Create Account

Step 1 — choose account type: School, Teacher, Parent, Student. (Administrator is never self-registered.)

Step 2 — Full name, Country, Email, Confirm email, Password, Confirm password. Students also give Date of birth (never age); it is stored privately and never displayed publicly. Role-specific extras already in the product (school name and type, display name, subjects) stay on their step.

Step 3 — two required checkboxes for Terms of Service and Privacy Policy, linking to the existing `/terms` and `/privacy` pages. Create Account stays disabled until both are ticked. A separate optional tick for product emails.

Step 4 — account created; the verification email goes out through the Email Dashboard.

Step 5 — "Check your inbox" screen with **Resend email** and **Use a different email**. The user clicks the link in the email to verify.

Step 6 — the link lands on a confirmation screen: account activated, continue to Login (already-signed-in users go straight to the building).

## 4. Login

One page for everyone: Email, Password, Remember me, Forgot password, plus Login and Create Account. No account-type picker — the role is detected after sign-in. Existing `/auth/school`, `/auth/teacher`, `/auth/parent`, `/auth/student` and `/auth/admin` URLs redirect to it so old links keep working; `/auth/admin` keeps sign-in only.

Unverified accounts are told to verify and offered a resend instead of a generic failure.

After sign-in every role lands on the Rotating Building. Students get the same building on the existing mobile-optimised shell, adapting to phone, tablet, laptop and desktop.

Forgot password: enter email → reset email sent through the dashboard → link opens the existing reset page → new password → back to Login.

## Technical section

**Database (one additive migration)**
- `platform_email_settings` — single row: sender name, sender email, reply-to, status notes. Owner-only RLS via `has_role(auth.uid(),'platform_owner')`; `service_role` full. GRANTs included.
- `platform_email_templates` — one row per template key with subject, body, footer, signature, `updated_by`. Same policy shape. Seeded with the eight defaults as literal INSERTs.
- `profiles` — add `full_name` (kept in sync with existing first/last), and reuse existing `date_of_birth`, `country`, `terms_accepted_at`, `marketing_opt_in`.

**Email pipeline**
- `email_domain--setup_email_infra` for the queue/log/suppression foundation, then `scaffold_auth_email_templates` so verification, reset and invite mails render with MathGPL branding; templates styled from the dashboard rows.
- `src/lib/email/send.functions.ts` — the only send entry point: resolves sender settings + template, substitutes placeholders, enqueues. Test send and all app notifications call it.
- Auth link redirects point at public routes (`/auth/verified`, `/auth/reset-password`), never a protected path.

**Frontend**
- `src/pages/WelcomePage.tsx`; `src/routes/index.tsx` renders Welcome or the existing `Index` from `useAuth()` state (no redirect, no flash).
- `src/pages/auth/LoginPage.tsx` at `/auth/login`; `/auth` becomes the same page; role routes become redirects.
- `src/pages/auth/SignUpPage.tsx` — stepped flow reusing the field config in `src/lib/accounts/authForms.ts`, Zod-validated (email match, password match, DOB sanity, length caps).
- `src/pages/auth/VerifiedPage.tsx` at `/auth/verified`.
- `src/pages/admin/EmailDashboard.tsx` at `/admin/email` with Sender, Connection, Test send and Templates tabs; linked from the console's Settings → System Settings. Guarded by the owner capability, not by hiding the link.
- Every content route gets its own head metadata; the Welcome and Login pages are `noindex`-free public pages, the dashboard is `noindex`.

## Not in this phase

Per-recipient delivery analytics, bulk/marketing sending, and per-role custom sender addresses.
