## What gets built

**1. Class creation and settings**
Create Class and Class Settings gain the Live-derived fields: description (exists), teaching days with per-day **start and end** time, time zone, and Location / Platform. Platform options reuse the existing Live platform list, with per-platform fields (Zoom → Meeting Link, Meeting ID, Password; Meet → link/code; WhatsApp/YouTube/TikTok → link; Other → custom name). One new option, **Classroom**, swaps those fields for Classroom Address and Classroom Details.

**2. Schedule section**
A new `Schedule` tile in the Class space and in the Live Session dashboard, sharing one component and one table. Teacher adds entries with a date, an optional week label, a topic, and a description; entries sort by date and can be edited or removed. Students see the schedule read-only.

**3. Coming Soon on the class/session landing**
Computed from the schedule plus the day/time settings: next class (day, date, start–end time, platform or classroom), the topic for that date, then an Upcoming Topics list. If no dated entries exist, it falls back to the next recurring occurrence from the teaching days. Visible to any member without the teacher starting anything.

**4. Join Class experience**
The join panel and the post-join class view show class name, teacher, next class, time, location/platform and joining information straight away, instead of a bare confirmation.

## Technical notes

Shared schedule logic lives in `src/lib/live/schedule.ts` (already handles per-day times) extended with per-day **end** times, and a new `src/lib/schedule/plan.ts` for dated teaching-plan entries plus next/upcoming computation. Location/platform reuses `src/lib/live/broadcast.ts`, extended with a `classroom` venue kind carrying address and details — Live keeps its current behaviour because a Live room simply never selects `classroom`.

Database work is staged as one additive migration, applied when this draft is accepted:

- `classes`: add `schedule_days`, `schedule_times`, `schedule_end_times`, `time_zone`, `broadcasts` (jsonb, same shape as sessions), `venue_kind`, `venue_address`, `venue_details`.
- `sessions`: add `schedule_end_times` so a session can show an end time too.
- New `teaching_schedule_entries` — one table for both, keyed by `scope` (`class` | `session`) + `scope_id`, with `entry_date`, `week_label`, `topic`, `description`, `position`, owner column, GRANTs, RLS: owner writes; class members / session audience read.

Existing Live Session functionality, permanent links, guest links, and the community share flow are untouched.
