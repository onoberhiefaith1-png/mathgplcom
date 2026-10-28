# Fix MathGPL signup, country list, password eyes, resend cooldown and email link

Scope is the signup/login forms and the existing confirmation email. No redesign, no new email service, no new templates.

## 1. First name + last name

- Replace the single "Full name" field on Create Account with required **First Name** and **Last Name** fields (the role-specific signup page already has these — keep them consistent).
- Store both separately on the profile (the profile table already has `first_name` and `last_name`, and the signup trigger already reads them from signup metadata), and keep sending a combined display name for UI labels.
- Validation: neither field can be empty.

## 2. Personalized email greeting

- The confirmation email greeting must use the **first name only**: "Hello Faith," — never the full name, never "Hello there," for a real signup.
- The auth email route currently prefers the full name; change its name lookup to prefer `first_name`, falling back to the first word of any name it can find.

## 3. Complete searchable country list

- Replace the short hand-written country array with a complete world country/territory list generated from the browser's own internationalization data (all ISO region codes, resolved to English names), sorted A→Z. No hand-maintained list.
- Replace the plain dropdown with a searchable country picker (type to filter) built from the components already in the project, used on both signup pages. The selected country continues to save to the profile exactly as today.

## 4. Independent password eyes

- Both signup pages currently share one visibility toggle. Give **Password** and **Confirm Password** their own independent state and their own eye button, so each reveals only its own field.

## 5. Resend confirmation with a live 60-second countdown

- After signup, the confirmation screen keeps the "Confirmation email sent" message and adds a visible countdown: the resend button is disabled and reads "Resend available in 59s… 58s…" until it hits zero, then becomes "Resend confirmation email".
- Every successful resend restarts the 60-second countdown; it never permanently disables.
- The cooldown timestamp is stored per email address in the browser so a refresh or a second tab still sees the remaining time. Server side, the platform's auth service already enforces its own hourly email limit, and its rate-limit response is surfaced as a friendly message instead of a raw error, so the cooldown cannot be bypassed by refreshing.
- Same countdown behaviour on the login screen's "not confirmed yet" resend and on the role-specific signup page, so all account types behave identically.

## 6. Clickable fallback link in the confirmation email

- In the existing confirmation email, the fallback URL under "Confirm My Email" is currently plain text. Render it as a real hyperlink pointing at the same genuine confirmation URL the button uses (the per-user token the auth system generates) — no static or fabricated URL, no design changes otherwise.
- Apply the same fix to the other account emails that show a fallback URL (password reset, invite, email change, magic link) so the behaviour is consistent.

## 7. Applies to every account type

All of the above lands in the shared signup form, the shared role signup page (school, teacher, parent, student, admin sign-in) and the shared resend helper — one implementation, no per-role variants.

## Technical notes

- Files touched: `src/pages/auth/SignUpPage.tsx`, `src/pages/auth/RoleAuthPage.tsx`, `src/pages/auth/LoginPage.tsx`, `src/lib/accounts/authForms.ts` (country data), a new searchable country field component, `src/lib/auth/resendConfirmation.ts` (expose remaining seconds for a ticking countdown), `src/lib/email-templates/brand.tsx` (first-name greeting helper + linked fallback style), `src/lib/email-templates/*.tsx` (clickable fallback), `src/routes/lovable/email/auth/webhook.ts` (prefer `first_name`).
- No database migration is required: `profiles.first_name` / `last_name` and the signup metadata trigger already exist.
- Verification: run a real signup, confirm the email arrives greeting the first name, click both the button and the fallback link, confirm login works, and watch the resend countdown reset after each resend.
