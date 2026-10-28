# Branded Account Emails: Confirm Account & Password Reset

MathGPL already has account creation and "forgot password" working, and the sending domain `notify.mathgpl.com` is configured (DNS still verifying). What's missing is branded email design: the two account emails currently go out with default wording.

This plan makes those two emails MathGPL-branded, sent automatically by the authentication system, with real verification and reset links.

## What you'll get

**1. Confirm Your Account** — sent the moment someone creates an account (student, teacher, parent, school or administrator).

- Subject: "Welcome to MathGPL — Confirm Your Account"
- Greets the person by name when we have it, otherwise "Hello there"
- One prominent "Confirm My Email" button, plus the same link in plain text underneath for mail clients that hide buttons
- "If you did not create this account, you can safely ignore this email" and a note not to share the link
- Signed "The MathGPL Team — mathgpl.com"

**2. Reset Your MathGPL Password** — sent when someone uses Forgot password.

- Subject: "Reset Your MathGPL Password"
- One "Reset My Password" button leading straight to the existing reset-password screen, plus plain-text fallback link
- Security notes: link expires, single request only, no password ever shown
- Reassurance that ignoring the email leaves the password unchanged, and a support contact if the emails were unexpected

**Design for both**: white background, MathGPL wordmark header, generous spacing, readable type, one brand-coloured button, and a footer with "MathGPL — Educational technology platform", mathgpl.com, Privacy Policy, Terms of Service and support@mathgpl.com. No marketing content.

Links and expiry come from the authentication system itself — nothing is faked or hardcoded, and tokens appear only inside the link.

## Not changed

Nothing else in the app moves: sign-up steps, login, the reset screen and the Email Control Centre all stay as they are. The other four auth emails (magic link, invitation, email change, re-authentication) get the same MathGPL shell so the family looks consistent, but no new flows are introduced.

## Technical section

- Scaffold the managed auth email templates and webhook route (`/lovable/email/auth/webhook`) with `email_domain--scaffold_auth_email_templates`. This is the only supported route for auth emails — it wires Supabase's real token URLs into React Email templates and enqueues through the existing `auth_emails` queue and `process-email-queue` route already present at `src/routes/lovable/email/queue/process.ts`.
- Style the generated templates in `supabase/functions/_shared/email-templates/` (or the modern `src/lib/email-templates/` path the tool reports) from the project's tokens in `src/styles.css`: navy heading ink, brand CTA colour, `#ffffff` body background per email-client rules. Shared header/footer partial reused by all six templates.
- `signup.tsx` and `recovery.tsx` get the exact copy above; `{{user_name}}` resolves from the user metadata (`full_name`/`display_name`) with a neutral fallback.
- Confirm `src/start.ts` middleware and `__root.tsx` `beforeLoad` let `/lovable/*` and `/email/unsubscribe` pass through untouched so the webhook and preview routes are reachable.
- Reset links keep pointing at `${origin}/auth/reset-password` (already used in `LoginPage.tsx`/`RoleAuthPage.tsx`); confirmation links keep `${origin}/auth/verified`. Both are public routes, so no auth gate blocks them.
- Auto-confirm stays off, otherwise confirmation emails are never sent. Expiry and single-use are enforced by the auth system; nothing custom.
- No duplicate sends: the auth system emits one event per signup/reset, and the queue is idempotent per message.

## Verification

After DNS verification completes, create a test account and request a reset, then confirm both emails were sent from the send log, that each link lands on the right screen, that a reused or expired link is refused, and that both render cleanly on phone and desktop.

While DNS is still verifying, the templates are in place and start sending automatically once the domain turns active — progress is visible in Cloud → Emails.
