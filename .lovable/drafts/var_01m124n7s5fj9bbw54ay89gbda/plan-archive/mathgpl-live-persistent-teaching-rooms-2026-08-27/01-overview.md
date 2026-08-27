# MathGPL Live — persistent teaching rooms

Today a Live Session is modelled as a one-time calendar event: `starts_at` plus
`duration_minutes`, and a helper (`scheduleStateOf`) turns "now is past the end
time" into the state **Ended**. That derived state drives the session badge, the
teacher session lists (Live / Upcoming / Past), the participant page, the guest
audience shell, and whether the broadcast links (Zoom, Facebook) are unlocked.

The room itself is never deleted, but everything on screen says the lesson is
over, and the broadcast links lock, so the session reads as expired.

This change makes a Live Session a permanent public teaching room with a
recurring schedule, and makes "LIVE NOW" a state the teacher turns on and off.

## What changes

1. **Recurring schedule instead of a date.** Creation asks for teaching day(s)
   (Monday–Sunday, multi-select), a time, a duration and a time zone — no
   calendar date. Stored as a recurring schedule on the session.
2. **Live is teacher-controlled.** The teacher presses **Start teaching** /
   **End teaching** on the session dashboard. That, and only that, produces
   LIVE NOW.
3. **Nothing expires.** The words "Ended", "Past sessions" and "Expired"
   disappear from the Live surfaces. A room shows either LIVE NOW or
   `Every Tuesday · 5:00 PM`, with `Next lesson: Tuesday · 5:00 PM` when the
   next occurrence is known.
4. **Access is never time-based.** Guests and signed-in visitors can open the
   room any day, any hour. Broadcast links stay visible whenever the room is
   open. Only the teacher's Free entry / Approval switch and an explicit delete
   change access.
5. **Community discovery.** A shared Live Session shows teacher, topic and
   `Every Tuesday · 5:00 PM` as informational metadata.

Existing sessions keep their identity, join code, invite link, notes,
SmartBoard, Challenge, Game Challenge, audience and teacher controls.
