# MathGPL Live — Phase 1

A duplicated teaching hub at `/live`, tailored for teaching mathematics online. The Teaching Hub stays exactly as it is. Every teaching feature (Lesson Notes, Smartboard, Assignments, Adventure, Assessment, Gallery, Reports) is reused unchanged — only classroom management is replaced by session management.

## Core idea

A **Session** is created with a backing class record behind the scenes. That means every existing class-scoped feature keeps working with zero rewrites, while the teacher only ever sees "Session".

```text
Lesson Note  ->  Session (schedule + code + visibility)  ->  Publish  ->  Go Live
                        |
                        +-- backing class row -> Smartboard, Assignments,
                            Adventure, Assessment, Gallery, Reports (reused as-is)
```

## What gets built in Phase 1

**1. Live hub shell**
- New route family under `/live` with its own navigation: Dashboard, Lesson Notes, Sessions, Smartboard, Assignments, Adventure, Assessment, Gallery, Reports, Settings.
- Live-branded landing page listing upcoming, live and past sessions.
- Entry tile added so you can move between Teaching Hub and MathGPL Live.

**2. Sessions**
- Create / edit / delete a session: title, description, attached lesson note.
- Scheduling: date, start time, duration, time zone.
- Live countdown ("Starts in 2 Hours 35 Minutes 18 Seconds") ticking every second on session cards and the session dashboard.
- Status derived from the schedule: Scheduled, Starting Soon, Live, Ended.
- Auto-generated 6-character Session Code plus a shareable join link.
- Visibility toggle: Private (code only) or Public (listed) — stored now, public profile page comes in Phase 2.

**3. Session dashboard**
- Same tile layout as the class dashboard, wording changed to Session, pointing at the existing feature pages for the backing class: Lesson Notes, Smartboard, Assignments, Adventure, Assessment, Gallery, Reports, Participants.

**4. Participant join flow**
- `/live/join` and `/live/join/:code` — enter the Session Code to join a session.
- Participant session page mirroring the current student class page (lesson notes, assignments, adventure, gallery, reports).
- Pre-start gate: before the scheduled time, participants see "Waiting for teacher — Class starts in 01:12:34" instead of the Smartboard.

## Deferred to Phase 2

Broadcast platform fields (Zoom, Meet, Teams, WhatsApp, YouTube, TikTok, Instagram, Facebook), public teacher profile page, public lesson-note preview, audience statistics (watching / joined / completed / left), and automatic schedule-driven Smartboard unlocking for all connected participants.

## Technical notes

- **Database (additive only):** new `sessions` table — `id`, `owner_id`, `class_id` (backing class, cascade delete), `notebook_id`, `title`, `description`, `starts_at`, `duration_minutes`, `time_zone`, `visibility` (`private` | `public`), `status` (`draft` | `published` | `live` | `ended`), `session_code` (unique), timestamps. Full GRANTs plus RLS: owners manage their own sessions; participants (members of the backing class) can read; anyone signed in can read `public` published sessions. Existing tables are untouched.
- Session creation runs in one step: insert the class row, then the session row referencing it. The existing join-code trigger on `classes` continues to work; the session code is generated separately for the Live branding.
- Live pages live under `src/pages/live/` and reuse existing components; class feature pages are wrapped with a Live layout that maps `sessionId -> classId`, so no existing page logic is duplicated or forked.
- Countdown handled by a small `useCountdown` hook; status recomputed from `starts_at` + `duration_minutes` on each tick.
