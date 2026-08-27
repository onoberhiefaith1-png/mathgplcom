## Technical notes

**Data (additive only; applies when this draft is accepted)**

- `sessions.allow_free_entry boolean not null default true` — the Allow Free Entry switch.
- New `session_audience` table: `id`, `session_id`, `guest_token`, `display_name`, `status` (`waiting` | `approved` | `removed`), `last_seen_at`, timestamps, unique on (`session_id`, `guest_token`). Grants for `anon`, `authenticated`, `service_role`; RLS: an anonymous visitor may insert and read/update only its own row for a published session; the session owner may read and update every row of their own sessions. Added to the realtime publication so the teacher's list and the visitor's approval state update live.
- Narrow `TO anon` SELECT policies, all scoped through the audience's approved row for a published session's class, on: `class_smartboard_state`, the session's shared `notebooks` / `notebook_sections` / `notebook_blocks`, `assessments` and `adventure_games`. Nothing else gains anon access; no existing policy is widened.
- Audience work (assessment progress, adventure runs) is written against the guest row for the session — never a `profiles` or `auth.users` identity, so no student profile or permanent history is created.

**Routing**

- `/live/join`, `/live/join/:code`, `/live/s/:sessionId` and the new `/live/s/:sessionId/{notes,board,challenge,game}` routes stay outside `RequireAuth` (the per-path gate in `src/routes/live/route.tsx` already supports this; the audience path list gains the new children).
- Join Code lookup resolves a code to its session id without a session, then routes straight to `/live/s/:sessionId` — never to `/auth`.
- Audience routes never link into `/student/*`, `/teaching-hub/*` or `/home`; the only outbound link is Visit MathGPL → `/`.

**Code**

- `src/lib/live/audience.ts` — join/heartbeat/approval helpers plus the entry decision (free entry vs waiting), reusing the existing guest token module.
- `src/pages/live/AudienceSessionPage.tsx` (replaces the tile list in `ParticipantSessionPage`) and four thin session-scoped pages that mount the existing note viewer, board viewer, assignment and adventure components in read/participate mode with Live terminology.
- `src/pages/live/SessionAudiencePage.tsx` — the teacher page (Join Code, Invite Link, Allow Free Entry, audience list, approvals); the session dashboard's Audience tile points here.
- Live terminology comes from the existing `productTerms` mapping (Session, Audience, Challenge, Game Challenge), extended with `Notes`.
- Tests: entry decision (free entry on/off, approved/waiting/removed), code→session resolution, and audience-visible surface list.

**Verification**

- Typecheck plus the new unit tests.
- A browser pass with no session: open an invite link with Free Entry on (lands straight in the audience environment), then with it off (waiting screen, then entry after the teacher approves), and confirm no audience route exposes reports, gallery or account areas.
