# Fix Go Live, the displayed name, and share-code identity

No redesign. Teaching Hub, workspaces, Community, navigation and the account page keep their current structure.

## Root cause (verified)

The account you are testing with (share code `UMJ2UAF7Q`, teacher ID `TCH/000007`) has **no profile record at all**. Five of the ten accounts on the platform are in that state.

Everything about Go Live is stored on the profile record. So when you press Go Live:

- the save runs, finds no profile record to update, reports success and changes nothing,
- the screen re-reads the setting, still sees "off", and the spinner simply stops,
- Community discovery, which reads the same record, never sees the account.

The same missing record explains the other two symptoms:

- The displayed name falls back to the part of the Gmail address before the `@`, because the registered first/last name was never stored on a profile.
- A share-code lookup finds the right account but has no profile to read a username from, so it shows a generic handle instead of the person's username.

Accounts created earlier (the school, teacher, parent, student test accounts) do have profile records, which is why Go Live works there — I confirmed it turns on, off and back on and persists correctly for those.

## What will be fixed

### 1. Every account gets its profile record

- Repair the existing five accounts: create their profile records from the details they registered with (first name, last name, role), issue any missing permanent ID and share code, and give each a default username.
- Make account setup create the profile record every time from now on, so a new sign-up can never end up in this state again. This happens at first sign-in as well as at registration, so any account that slips through is self-healed.
- Registered name is taken from the name given at registration (including a Google sign-in's full name) and only falls back to the email prefix if no name exists anywhere.

### 2. Go Live actually completes and persists

- Saving Go Live and "Accept connection requests" will fail loudly if there is nothing to update, instead of reporting a false success.
- Both entry points — the control at the foot of the Teaching Hub navigation and the Go Live section on the Account page — open the same confirmation modal and run the same save.
- The modal keeps its current wording and layout: what going live means, that private workspace data stays private, "Accept connection requests", "I understand and agree", Cancel and Go Live.
- On success the toggle switches to Live immediately, and it stays Live after a refresh, when returning to the Teaching Hub, and on the Account page.
- On failure a readable error message is shown instead of a spinner that stops.

### 3. Name, username, email, private ID

- Registered name: first name + last name from registration, shown as the account's name and never replaced by the email address.
- Username: the public handle, editable in the account settings, used for searching and identifying people.
- The "Registered name" and "Username" labels on the Account page are currently almost invisible (pale text on white) — that is a contrast fix, not a redesign.
- Email stays private and is never used as a name or handle.
- The permanent MathGPL ID stays visible only to its owner (and the platform owner), never in Community results, requests or public profiles.

### 4. Share code keeps working

Share-code lookup already finds the correct account; with profile records repaired it will show the real username and name instead of a generic handle. A valid code will never read as "account not found", and no internal identifier is exposed.

### 5. Cancel button contrast

The Cancel button in the Go Live modal gets light text on its dark background, and continues to close the modal without changing anything.

## Technical notes

- Migration: backfill `public.profiles` for users missing a row (name from `auth.users` metadata, username via `default_username`), call `issue_account_id` where `account_ids` is missing, and add a profile-creation step to `ensure_account` so first sign-in self-heals. The unattached `handle_new_user_profile` name fallback is extended to read `full_name`/`name` metadata.
- `set_go_live` and `set_accepts_requests` raise when zero rows are updated, so the client surfaces a real error.
- Client: error toasts around `setLive`/`setAcceptsRequests` in `GoLiveExplainDialog`, `GoLiveToggle` and `WorkspaceGoLive`; label contrast and Cancel-button variant fixes only.

## Verification

Sign in with the affected account: Teaching Hub → Go Live → modal → agree → Go Live turns on and survives a refresh; Account shows Live; the account appears in Community discovery; turning it off from Account persists as off. Registered name shows the registered name, not the Gmail, the username shows as `@handle`, and a share-code lookup of that account shows its username with no MathGPL ID anywhere.
