# Go Live, connection requests and public identity

Scope is limited to Go Live, Community discovery, public usernames, share codes and connection requests. No changes to the Teaching Hub structure, workspace architecture or unrelated pages, and the existing dark gold/violet visual language stays.

## What is actually broken today (verified)

- The sidebar Go Live card only reacts on the small switch itself, and it flips Live straight on with no explanation. The full explanation dialog exists only on the account page.
- Two accounts of the same type cannot be connected at all. The database relation list contains only school–teacher, school–student, teacher–student, parent–child, parent–teacher and parent–school. So after a code lookup succeeds, a teacher looking up another teacher is told the two accounts "cannot be connected directly" — which reads as "account not found".
- The permanent MathGPL ID (e.g. `TCH/000001`) is printed in the code-lookup result, in Community cards and in request rows. It is the internal identifier and should not be the public identity.
- A username exists only for Community publishing (`community_profiles.username`); it is not used as the public identity for discovery, code lookup or requests, and teachers have no default username.

## Part 1 — Go Live behaves the same everywhere

- The whole sidebar Go Live card becomes one clickable control. Clicking it (anywhere, including the switch) when off opens the same confirmation dialog used on the account page: what Go Live means, that it is discovery only, that nobody gains access to lessons, assignments, classes or student records, and that only content deliberately published is visible. Cancel / Go Live. Turning Live off stays a single click, no dialog.
- Go Live state is read from one shared source, so the sidebar card, the account page and any Community banner always agree; changing it in one place updates the others immediately.
- "Account & Go Live" in the navigation keeps opening the account page, which gains a clear ordering: profile picture, name, username, public-profile preview, Go Live, Accept connection requests, share code, connections.

## Part 2 — Accept connection requests

- Presented directly beneath Go Live, on by default, with the wording from the specification. It stays a separate control: Live can be on with requests off.
- With requests off: nobody can send a new request (refused server-side, not merely hidden), the account is still discoverable while Live, can still send its own requests, and existing connections are untouched.
- Anywhere a request button appears (Community card, public profile, code-lookup result), it is replaced by "This account is not accepting new connection requests at the moment."

## Part 3 — Public identity: username instead of internal ID

- Every account gets a public username, defaulting from the registered first name (with a numeric suffix if taken). Name stays read-only as the registered identity; username is editable by the account holder.
- A Teacher Profile section in the account/settings page: profile picture, read-only registered name, editable username, and a live public-profile preview — `@MathsWithDan`, account type, connected schools, students, Live dot.
- The internal MathGPL ID disappears from every public surface: Community cards, search results, public profiles, code-lookup results and request rows. It remains visible only to the account holder on their own account page (and to the platform owner in the admin console).

## Part 4 — Share code and connection flow

- Code lookup keeps accepting School Code, MathGPL ID and personal share code, and keeps using the internal ID behind the scenes to find the account — but the result card now shows only the public profile: username, account type, verified account-type badge, profile picture, and the request button.
- Same-type connections become possible, so teacher ↔ teacher, student ↔ student and school ↔ school requests work; the button reads "Request to connect". Existing cross-type wording is unchanged.
- Full flow: goes Live → appears in the matching Community category → other account discovers or resolves the code → opens the public profile → Connect → request is created only if the recipient accepts requests, otherwise the not-accepting message is shown.

## Part 5 — Community shows Live accounts

Community's Schools, Teachers and Students categories list Live accounts by public username, ranked as they are today, with Assets and Games untouched. Parents remain discoverable in their own category with the reduced card already specified.

## Privacy line

Public: username, profile picture, account type, public counts, deliberately published content, connection availability. Private and unaffected: lessons, assignments, classes, students, records, workspace settings, email, internal ID.

## Technical notes

- Additive migration: `public.profiles.username citext unique` (backfilled from first name / display name), plus a `set_my_username` RPC with validation. `community_profiles.username` continues to work and is kept in step.
- Extend the `connection_relation` enum with `teacher_teacher`, `student_student`, `school_school`; `relationFor` in `src/lib/connections/connections.ts` maps same-type pairs; `request_connection` accepts them and keeps its accepts-requests refusal.
- `resolve_account_code`, `discover_accounts`, `discover_schools`, `my_connections` return `username` and stop returning `mathgpl_id` for other people's accounts; client types drop `counterpartMathgplId` / `mathgplId` from public rendering.
- `useGoLive` stays the single state hook; `WorkspaceGoLive.tsx` gains the shared confirmation dialog (extracted from `GoLiveToggle.tsx` into one reusable dialog component).

## Verification

Sign in as a teacher: clicking anywhere on the sidebar Go Live card opens the explanation, confirming turns Live on, and the account page shows Live too. Turning accept-requests off makes request buttons vanish and a forced request fail. Looking up another teacher's share code shows `@username` with a working Connect button and no `TCH/…` anywhere. Community lists Live teachers by username.
