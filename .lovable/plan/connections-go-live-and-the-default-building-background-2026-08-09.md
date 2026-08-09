# Connections, Go Live, and the default building background

Two things, in order. Permanent MathGPL IDs stay exactly as they are (`TCH/000001`, `SC/000001`, …) — nothing is renumbered, no country code is added.

## Part 1 — Connections and Go Live

The connection engine already exists (permanent IDs, share codes, request/accept/reject, a Requests hub, Community discovery for schools, teachers and students). This part closes the missing pieces of the specification.

**Accept connection requests — a separate setting**
- A new per-account setting, ON by default, stored on the account and enforced in the database: when it is OFF, a request sent to that account is refused server-side, not merely hidden.
- Shown on My account next to Go Live, with the four honest states: Private, Private + requests off, Live + accepting requests, Live + requests off.
- On a public profile or discovery card, the request button disappears when the account is not accepting requests.

**Go Live becomes a deliberate choice**
- Clicking Go Live opens an explanation first: your account becomes discoverable in the Community, people may find your public profile, people may send you connection requests if you allow them, your private workspace stays private, your password and private details are never exposed, going Live does not let anyone enter your workspace.
- The person must tick "I understand and agree", then press Go Live. Accept requests is shown as ON inside that screen and can be turned off there.
- Turning Live off stays a single click, with no ceremony.

**Community becomes the discovery layer for every account type**
- Four categories at the top: Schools, Teachers, Students, Parents (Parents is new).
- Each category keeps the existing activity-based ranking plus search.
- Student and parent cards deliberately carry less: name, account type, MathGPL ID and Live status only — no school, no email, no child information.

**Requests read like real relationships**
- The action wording adapts: Request to Join School, Invite Teacher, Request to Connect, Request to Work With School, Connect to My Child.
- The Requests hub gains "View profile" on each row and keeps its four lists (incoming, outgoing, connections, rejected).

**Navigation per role**
- School: Dashboard, Teachers, Students, Requests, Community, Go Live, Account, Security, Settings, Sign out. Teaching Hub is removed from School administration.
- Teacher: Teaching Hub, My Schools, My Students, Parents, Other Teachers, Requests, Community, Go Live, Account, Security, Settings, Sign out.
- Student: existing learning items plus My Schools, My Teachers, Requests, Community, Go Live, Account.
- Parent: My Children, My Schools, My Teachers, Requests, Community, Go Live, Account.
- Each dashboard shows its real connection summary — counts read from the database, never typed in.

Existing behaviour that must not change: ID + password login, no Google button, account confirmation, password reset and all transactional email, the rotating building, the Teaching Hub, and workspace switching.

## Part 2 — The homepage building video becomes the platform default background

Today each account stores its own homepage background, and an account with none falls back to the shipped clouds artwork; students instead mirror their school's configuration. That fallback becomes the real thing.

- The background used by the rotating building on the founder homepage is promoted to a single platform default, stored once and referenced — never copied into each account.
- Any account that has never customised its background sees that exact looping video, in every place the rotating building appears. No static stand-in, no duplicated video files.
- An account that customises its background keeps its own from then on, across sign-outs, and a later change to the platform default leaves it untouched.
- Changing the platform default (administrator only) immediately changes what every uncustomised account sees.
- Viewing someone else's workspace never lets you edit their background.

## Technical notes

- Migration: `profiles.accepts_requests boolean not null default true`; `request_connection` raises when the recipient has it off; discovery functions return the flag so cards can hide the button. A `parents` branch is added to `discover_accounts`, with a reduced column set for students and parents.
- Go Live confirmation is a dialog around the existing `set_go_live` RPC; the toggle itself stays.
- Platform default background: a single-row `platform_settings`-style record holding a media reference, readable by everyone (`TO anon`/`authenticated` SELECT), writable only by the platform owner. `useHomepageConfig` resolves background as: account custom → school override (existing) → platform default → shipped artwork, and the video path already supported by the background layer is reused for both image and video refs.
- Role navigation edits live in `src/lib/accounts/roles.ts`; the connection counts come from the existing `my_connection_counts` RPC.

## Verification

Sign in as school, teacher, student and parent: Go Live requires the explanation and the tick; turning accept-requests off makes the request button vanish and a forced request fail server-side; each role's menu matches the list above and School has no Teaching Hub; Parents appear in Community; an uncustomised account shows the looping video behind the building, a customised one keeps its own, and changing the platform default moves only the uncustomised ones.
