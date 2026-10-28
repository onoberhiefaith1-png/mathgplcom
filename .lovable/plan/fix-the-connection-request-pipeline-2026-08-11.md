# Fix the connection request pipeline

## What is actually wrong (verified in the database)

Five accounts have no row in the account-role table, even though their permanent MathGPL ID and profile exist:

```text
faith Faith  @faith2     TCH/000007   role rows: none   (live, shown in Community)
faith        @faith       TCH/000008   role rows: none
Faith Onob.  @Faith1      TCH/000006   role rows: none
Emmanuel O.  @Emmanuel    TCH/000009   role rows: none
Faith        @Faith3      SC/000002    role rows: none
```

The request routine asks for both sides' account type before creating anything. When either side has no role row it stops with `unknown_account`, which the screen shows as "Could not send request — unknown account". This is why both Community requests and Share Code requests fail on exactly those accounts: the account is found (the lookup reads the ID table, which is intact) but the request itself is refused.

A second, related refusal: while you are viewing a workspace as a school, the request is still made by your own signed-in account, whose top role is platform owner. A platform-owner account matches no teacher/school/student/parent pairing, so requests sent from an impersonated workspace are refused as an invalid relationship.

## Part 1 — Repair the accounts and make the gap impossible

- Backfill a role row for every account that has an ID but no role, taking the role already recorded on its permanent ID (TCH → teacher, SC → school, STU → student, PAR → parent).
- Make ID issuing and role assignment happen together, so an account can never again exist with an ID and no role.
- The account-type lookup falls back to the role stored on the permanent ID when a role row is somehow missing, so a single missing row can never break requests again.

## Part 2 — Make the request itself succeed

- Requests are sent as the real signed-in account. While a platform owner is viewing another workspace, the request buttons are replaced with a short line explaining that connections are sent from your own account, rather than failing with an error.
- Same-type pairs (teacher ↔ teacher, student ↔ student, school ↔ school) already exist in the database and stay supported.
- Every refusal becomes a sentence a person can act on instead of a code word:
  - unknown account → "That account isn't set up for connections yet. We've reported it — try again shortly."
  - not accepting requests → "This account isn't accepting new connection requests at the moment."
  - already requested → the existing request is shown ("Request already sent — waiting for a reply") instead of an error.

## Part 3 — The recipient actually sees the request

- A sent request lands immediately in the recipient's Requests inbox under Incoming, with the sender's public identity (@username, account type, profile picture) and a plain-English line describing what is being asked, matched to the relationship:
  - a school inviting a teacher → "Faith's School has invited you to join their school workspace."
  - a teacher asking a school → "@Emmanuel has asked to work with your school."
  - teacher ↔ teacher → "@faith2 has requested to connect with you."
  - parent ↔ child / parent ↔ teacher / school ↔ student worded the same way.
- Accept and Decline sit on the row. Accepting creates the connection (and, for school–teacher / school–student, the workspace membership) exactly as today; declining closes it.
- The pending count already shown next to Requests in the sidebar is checked so the badge appears for the recipient as soon as a request arrives, and clears when answered.
- The sender's Outgoing tab shows the same request as "Waiting for a reply", with Withdraw.

## Technical notes

- Additive migration: backfill `public.user_roles` from `public.account_ids.role`; update `issue_account_id` / `ensure_account` to always insert the matching role row; `account_role_of` and `current_role_name` fall back to `account_ids.role`.
- `request_connection` keeps its `accepts_requests` refusal and its duplicate-request short-circuit; the client maps its exception names to readable messages in `src/lib/connections/connections.ts`.
- Request wording lives in one helper next to `relationLabel`, used by `RequestsPage.tsx`, the Community card and `ConnectByCodeDialog.tsx`.
- Impersonation state comes from the existing workspace-scope helper; no change to how impersonation works.

## Verification

Sign in as a teacher, look up `@faith2` (or her Share Code) and send a request: it succeeds. Sign in as that teacher and the request appears under Incoming with the sentence explaining who asked and for what, with a badge on Requests; accepting moves it to Connections on both sides.
