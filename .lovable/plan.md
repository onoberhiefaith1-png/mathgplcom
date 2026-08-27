# Live = a permanent public teaching room

Rework the Live lifecycle so a room is a continuous public broadcast space, not a one-time session. The schedule becomes pure information; only the teacher's **Start teaching** switch decides whether a visitor lands on the information page or the teaching dashboard. Existing teaching tools (Lesson Notes, SmartBoard, Challenge, Game Challenge, Gallery, Reports) stay exactly as they are.

## 1. Per-day teaching times

The create form currently has one shared hour/minute for all ticked days. Replace it so each selected day owns its own time:

```text
Teaching Days
 [x] Monday      Time: 4:00 PM
 [x] Tuesday     Time: 5:00 PM
 [x] Thursday    Time: 6:00 PM
```

- No time field is shown until a day is ticked; unticking a day removes its time.
- "Next teaching time" is computed per day, so Monday 4 PM and Thursday 6 PM are both honoured.
- Rooms created earlier with one shared time keep working: that time is applied to each of their days on read.

## 2. Permanent room, never expiring

- The room code and join link are created once and keep working forever, whether or not the teacher is teaching.
- Remove every "session ended / expired / unavailable / not open" outcome for a room that still exists — including the current "Session unavailable" screen, the audience "This session is not open" screen, and the join-panel "This room is not open yet" message.
- A lookup only fails when the code matches no room at all, and then it reads as "this code doesn't match a room", never "the room is closed".

## 3. Two states behind one link

- **Teacher not teaching** → Live Broadcast Information page: room name, teacher name, subject/topic, each teaching day with its own time, next teaching time, broadcast platform(s) with link/ID/password/notes, room code, free-entry status, and a clear "the teacher is not currently teaching" status line.
- **Teacher teaching** → straight into the existing Live teaching dashboard (Notes, SmartBoard, Challenge, Game Challenge), synchronised with what the teacher is presenting.
- The page flips state live: a visitor sitting on the information page enters the dashboard as soon as the teacher starts, with no reload.

## 4. Public, free access

- Free entry stays on by default for new rooms.
- Platform join details (Zoom ID, password, YouTube/TikTok/WhatsApp links) are shown publicly on the information page — they are broadcast advertising, not private credentials. This reverses the earlier "credentials only after admission" behaviour at your request, and I'll record it in the security memory.
- The approval queue remains available only when the teacher explicitly turns free entry off.

## 5. Broadcast platform fields

Keep the existing platform picker (Zoom, Google Meet, Teams, WhatsApp, YouTube, TikTok, Instagram, Facebook, Other) showing only the fields that platform needs — Zoom: Meeting ID, Password, Link; WhatsApp/YouTube/TikTok: just the link. Multiple platforms per room stay supported.

## 6. Room card + actions

Each room card in the teacher's Live area shows: name, teacher, subject, Public badge, each teaching day with its time, current status (Live now / Not teaching), and the room code. Cards are permanent. Actions:
- **Start / Stop teaching** — the switch that flips the room state.
- **Settings** — opens the same setup form loaded with that room's values and **saves back to that room** (never creates a second room).
- **Show in Community** — opens the room's community listing.
- **Delete** — removes the room after confirmation.

## 7. Community discovery

Community Live cards show teacher, subject, each day with its time, and the broadcast platform, so a browser can tell who teaches what, when and where — with a link into the room's information page.

## Technical notes

- `schedule_times jsonb` already exists on `public.sessions` and `src/lib/live/schedule.ts` already implements per-day times, hydration from the legacy `schedule_time`, and `nextOccurrence`. No new migration is needed for scheduling; only the RPCs change.
- Update `live_public_session` to return `schedule_times`, teacher display name, subject/topic and unsanitised `broadcasts`; drop the `live_admitted_broadcast_credentials` call from the client. `lookup_session_by_code` must resolve any existing room regardless of `is_live`.
- New `src/components/live/ScheduleEditor.tsx` (day checkbox + its own time field), used by create and settings; new `src/pages/live/RoomInfoPage.tsx` for the not-teaching state.
- `CreateSessionPage.tsx` becomes create-or-edit driven by an optional `sessionId` param, with a new route `/live/sessions/$sessionId/settings`; add `updateSession` to `src/lib/live/sessions.ts` for the save-back path.
- `ParticipantSessionPage.tsx` / `AudienceSessionPage.tsx` / `AudienceShell.tsx` / `useAudienceAccess`: render `RoomInfoPage` when `is_live` is false and the dashboard when true, with a realtime subscription on the session row for the flip; remove the unavailable/not-open branches for existing rooms.
- `SessionsPage.tsx` cards gain Start/Stop, Settings, Show in Community and Delete; `CommunitySectionPage` session card shows the per-day schedule and platform.
- Tests for per-day next-occurrence, legacy single-time hydration, and the not-teaching/teaching routing decision.
