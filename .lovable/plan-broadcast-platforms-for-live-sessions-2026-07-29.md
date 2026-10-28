# Broadcast Platforms for Live Sessions

Let teachers say *where* the live class actually happens (Zoom, Meet, WhatsApp, TikTok, etc.) and show that to participants. The app never opens or integrates with those platforms — it only stores and displays the link/code the teacher typed.

## Teacher side (under Schedule, in Create Session and Session Dashboard)

A "Broadcast" section listing the platforms:

- Zoom, Google Meet, Microsoft Teams, WhatsApp, YouTube Live, TikTok Live, Instagram Live, Facebook Live
- Plus "Other" — teacher types their own platform name

For each platform the teacher picks, they can fill:
- Link (URL)
- Code / Meeting ID (optional)
- Password (optional)
- Note (optional, e.g. "join 5 min early")

The teacher can add more than one platform (e.g. Zoom + WhatsApp backup) via an "Add platform" button, and remove any row. Only the entries the teacher fills in exist — nothing is preset or auto-filled.

## Participant side

On the participant session page, a "How to join this class" card lists exactly the platforms the teacher entered: platform name + icon, the link (opens in a new tab), and copy buttons for the link, code and password. If the teacher entered nothing, the card is hidden.

Visibility rule: broadcast details appear to participants once the session reaches its start time (same gate as the Smartboard). Before that they see "Broadcast details appear when the class starts". Teacher always sees them.

## Technical notes

- Additive migration: add a `broadcasts jsonb not null default '[]'` column to `public.sessions`. No existing table or column is modified.
- Each entry: `{ id, platform, customName?, link?, code?, password?, note? }`.
- New file `src/lib/live/broadcast.ts` — platform catalogue (id, label, which fields to show) and the entry type, plus a small helper to normalise/validate entries.
- New component `src/components/live/BroadcastEditor.tsx` — the teacher's repeatable platform rows; used by `CreateSessionPage.tsx` (below the schedule fields) and `SessionDashboardPage.tsx` (editable after creation, saves to the session row).
- New component `src/components/live/BroadcastPanel.tsx` — read-only display used by `ParticipantSessionPage.tsx`.
- `src/lib/live/sessions.ts` — extend `LiveSession` type with `broadcasts`, accept them in `createSession`, add an `updateSessionBroadcasts` helper.
- Existing RLS on `sessions` already governs who can read the row, so no policy changes are needed; the start-time gate is enforced in the participant UI.
- Styling follows the existing readable field surface used on the create form; no layout changes elsewhere.
