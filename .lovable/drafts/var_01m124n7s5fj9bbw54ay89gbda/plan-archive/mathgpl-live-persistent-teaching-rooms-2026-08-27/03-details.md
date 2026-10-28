## Technical detail

### Data (staged additive migration, applies when this draft is accepted)

Add to `public.sessions`:

- `schedule_days smallint[] not null default '{}'` — 0 = Sunday … 6 = Saturday.
- `schedule_time text` — `"HH:MM"` in the session's `time_zone`.
- `is_live boolean not null default false` — teacher-controlled live state.
- `live_started_at timestamptz` — for the LIVE NOW indicator.

`starts_at` is left in place (nullable, no longer written by creation) so old
rows and any existing reads keep working; a one-time backfill derives
`schedule_days`/`schedule_time` from an existing `starts_at`. No column is
dropped or retyped. `duration_minutes` and `time_zone` are kept — duration is
still useful ("Tuesdays · 5:00 PM · 1 hr") but no longer ends anything.

### Session model (`src/lib/live/sessions.ts`)

- Replace `ScheduleState` with `RoomState = "live" | "scheduled" | "open"`.
  `live` comes from `is_live`, never from the clock. Remove `"ended"` and
  `"starting-soon"` from the access path.
- Add `nextOccurrence(days, time, timeZone, now)` returning the next matching
  day/time, plus `formatRecurring(days, time)` → `"Every Tuesday · 5:00 PM"` and
  `"Mondays & Thursdays · 4:00 PM"`.
- `SESSION_COLUMNS` gains the new columns; `hydrateSession` defaults them so a
  row still loads before the migration lands.
- Add `setLiveState(sessionId, isLive)`.

### Screens

- **Create Session** (`CreateSessionPage.tsx`): drop the date picker; add a
  seven-day toggle row plus time, keep duration, time zone, lesson note,
  description, visibility, ask-name and broadcast links. Session name and
  subject/topic stay as they are today.
- **Session dashboard** (`SessionDashboardPage.tsx`): recurring schedule line,
  `Next lesson: …`, and a primary **Start teaching / End teaching** button
  driving `is_live`. Join code, invite link and the Free entry switch unchanged
  and always valid.
- **Sessions list** (`SessionsPage.tsx`): groups become **Live now** and **My
  teaching rooms**. No "Past sessions".
- **Audience shell + audience/participant pages**: badge shows LIVE NOW or the
  recurring line; remove the `locked` gate so `BroadcastPanel` is always
  unlocked while the room is open; the not-found copy stops implying "not open
  yet" and only appears when the row genuinely does not exist.
- **Community**: the `session` resource card shows teacher, topic and
  `Every Tuesday · 5:00 PM`, and links into the room.

### Access

Unchanged and time-independent: anonymous read of an open session row plus
`lookup_session_by_code`, then the Free entry / Approval decision in
`entryDecision`. Nothing consults the schedule. Only teacher deletion removes a
room; `status` stays for draft/published/ended-by-teacher, never set by a timer.

### Tests

Unit tests for `nextOccurrence` and `formatRecurring` (multi-day, wrap to next
week, time zone), and a regression test asserting that no room state depends on
`now` versus `starts_at` — a visitor arriving days after the scheduled time
still resolves to an open room.
