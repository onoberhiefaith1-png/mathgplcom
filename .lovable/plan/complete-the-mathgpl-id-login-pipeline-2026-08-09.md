# Complete the MathGPL ID login pipeline

Most of what you described is already live: every account already carries one permanent MathGPL ID (`ADM/…`, `SC/…`, `TCH/…`, `STU/…`, `PAR/…`), the login form already asks for **MathGPL ID + Password**, the ID is resolved server-side and never exposes an email, the ID appears on the sign-up success screen and inside the confirmation email, and all 9 existing accounts already have an ID with their email, workspaces, schools and content untouched. No leftover email+password sign-in path exists in the app (the only one left is the administrator's internal "Enter Workspace" impersonation, which is intentional).

So this is a completion-and-repair pass on the parts that are still missing or blurred, not a rebuild.

## 1. Forgot User ID (separate from Forgot Password)

Today "Forgot ID or password?" is a single flow that sends one reset email carrying the ID. Split it:

- **Forgot MathGPL ID** — enter the registered email, receive an email containing only the existing ID. Never generates a new ID. Always shows the same neutral confirmation whether or not the address exists, so the form can't be used to test which emails are registered.
- **Forgot Password** — unchanged reset link through the registered email; it also keeps showing the ID for convenience. Reset never changes the ID.

New branded email: **"Your MathGPL ID"** — greeting by first name, the ID, the registered address, and a note that the ID plus their password is how they log in.

## 2. Dedicated "Account created" email

Right now the ID travels on the confirmation email. Keep that (it's the email a new user actually opens) and additionally send the wording you specified — *Your MathGPL Account Has Been Created* with first name, ID and registered email — as its own message once the account is confirmed, so a person who signed up weeks ago still has a clean record of their ID. All values are pulled from the real account; no placeholders.

## 3. Safety net for an account with no ID

Any account that somehow has no ID (older row, admin-created, failed trigger) gets one issued automatically during sign-in and email lookup, against the same user record — never a second account, workspace or membership.

## 4. Login error messages

You asked for distinct messages for "ID not found" vs "wrong password". Distinguishing them lets anyone confirm which IDs exist, and IDs are sequential and guessable (`TCH/000001`, `TCH/000002`…), so I'll keep one message for both — *"Incorrect MathGPL ID or password. Use Forgot MathGPL ID if you're not sure of your ID."* — and keep the separate, already-working message for an unconfirmed email. Say the word and I'll switch to the two distinct messages instead.

## 5. Login screen copy

Label the field **User ID (MathGPL ID)** with an example placeholder, keep the password eye toggle, and show two clearly separate links: *Forgot MathGPL ID?* and *Forgot password?*. Nothing asks for an email to log in.

## Technical notes

- New server functions in `src/lib/accounts/accountId.functions.ts`: `sendMathgplIdReminder({ email })` (service-role lookup of `auth.users` → `account_ids`, enqueues the new template, uniform response) and an `ensureAccountId` fallback calling the existing `issue_account_id` SECURITY DEFINER function.
- New template `src/lib/email-templates/account-id.tsx` and `account-created.tsx` on the existing `brand.tsx` shell; both enqueue through the existing queue pipeline (`enqueue_email` → `/lovable/email/queue/process`). No email infrastructure, domain, webhook or cron change.
- `LoginPage.tsx` and `RoleAuthPage.tsx`: split the forgot flow into two modes, update labels and error copy.
- No schema migration needed — `account_ids` already enforces uniqueness and immutability, and no account is missing a row.

## Verification

End-to-end after the change: create a fresh test account and confirm the ID is issued, stored, shown and emailed with the real name/ID/email; log in with that ID; confirm wrong ID and wrong password are both rejected; log in as an existing account and confirm the same workspaces, school links and lesson notes load with no duplicate account, workspace or membership; run Forgot MathGPL ID and confirm the existing ID is emailed unchanged; run Forgot Password and confirm reset still works. I'll report each result explicitly, including anything that fails.
