# Readable login fields + a real Email Control Centre

## 1. Fix the unreadable text in every auth form

Right now the input boxes are white but the typed text inherits the page's white
text colour, so what you type is invisible. Fix on Login, Sign Up (all steps),
Password Reset, Accept Invite and the role auth page:

- Input, textarea and select fields get a solid white background with dark ink
  (`text-slate-900`) and a readable grey placeholder.
- The date-of-birth field gets the same treatment (currently faint amber text).
- Password reveal icon stays dark on white.
- Applied through one shared field class so every auth screen matches and no
  future field can drift back to white-on-white.

## 2. Email Control Centre (owner only, at Account → Email Dashboard)

The dashboard already exists but only covers sender + templates. It gets
expanded into the full control centre you described:

**Sender identity**
- Change sender name, sender email (your Gmail today, mathgpl.com later) and
  reply-to; saving applies instantly to every email the platform sends.
- Keep a list of saved sender addresses so you can swap between them (remove one,
  add another, mark which is active) instead of retyping.

**Templates (fully editable by you)**
- All 8 templates: subject, body, footer, signature — already editable, kept.
- Added: colour and branding controls per template — heading colour, button
  colour, text colour, button label and logo/heading line — stored with the
  template and used when the email is rendered, so you restyle emails yourself
  with no code change.
- Live preview beside the editor, plus "Reset to default wording".
- Send test email to any address from the active template.

**Activity (how many emails have been sent)**
- Summary cards: total emails, sent, failed, suppressed for the selected period.
- Time range: last 24 hours / 7 days / 30 days / custom dates.
- Filters by template and by status.
- A log table: template, recipient, status badge, timestamp, and the failure
  reason when something didn't go out. Paged, newest first.
- Counts are per unique email, so a single message never shows twice.

**Connection**
- Existing status panel kept: whether sending is live, the last error, and what
  to do next when a sending domain is still verifying.

## Technical notes

- Auth pages: shared `AUTH_FIELD` class in `src/lib/accounts/authForms.ts`
  applied in `LoginPage.tsx`, `SignUpPage.tsx`, `ResetPasswordPage.tsx`,
  `AcceptInvitePage.tsx`, `RoleAuthPage.tsx`.
- Additive migration: `platform_email_senders` (saved sender addresses, one
  active) and brand columns on `platform_email_templates`
  (`heading_color`, `text_color`, `button_color`, `button_label`, `logo_text`),
  with GRANTs and owner-only RLS via `has_role`.
- New server functions in `src/lib/email/emailAdmin.functions.ts`:
  `fetchEmailActivity` (deduplicated by `message_id` from `email_send_log`),
  `saveEmailBrand`, `addSender` / `removeSender` / `activateSender` — all behind
  the existing owner check in `platformEmail.server.ts`.
- `platformEmail.server.ts` renders brand values into the outgoing payload so
  colour edits take effect for real sends.
- `EmailDashboard.tsx` gains an **Activity** tab and brand controls in the
  Templates tab; route `/admin/email` stays owner-guarded and `noindex`.
