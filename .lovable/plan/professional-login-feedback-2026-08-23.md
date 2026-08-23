# Professional Login Feedback

Replace the single generic credential-failure message with distinct, professional messages for each failure case.

## Changes

1. **Server function** (`src/lib/accounts/accountId.functions.ts`)
   - Extend the `reason` union returned by `signInWithMathgplId` to distinguish:
     - `"id_not_found"` — MathGPL ID does not exist or is malformed
     - `"email_not_found"` — ID exists but no email is attached to the account
     - `"password_incorrect"` — email exists but password verification failed
   - Keep `"unconfirmed"` and `"throttled"` as-is.
   - Return a clear, professional `message` for each reason.

2. **Shared messages** (`src/lib/accounts/accountIdRules.ts`)
   - Add constants for the new messages:
     - `ID_NOT_FOUND_MESSAGE = "We couldn't find a MathGPL ID matching that entry."`
     - `EMAIL_NOT_FOUND_MESSAGE = "This account does not have a registered email address."`
     - `PASSWORD_INCORRECT_MESSAGE = "The password you entered is incorrect."`

3. **Login UI** (`src/pages/auth/LoginPage.tsx` and `src/pages/auth/RoleAuthPage.tsx`)
   - Map each new `reason` to a toast title + description that matches the failure.
   - Keep the existing unconfirmed/throttled handling.

## Security note

Distinct failure messages allow user enumeration: an attacker can learn whether a given MathGPL ID is registered. The user has accepted this trade-off for better UX. I will record this decision in the project security memory so future scans do not flag it as an unintended information-disclosure issue.

## Files to modify

- `src/lib/accounts/accountId.functions.ts`
- `src/lib/accounts/accountIdRules.ts`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/RoleAuthPage.tsx`
- Project security memory (via `security--update_memory`)
