## Technical detail

**Data.** The Live room row already carries `schedule_days`, `is_live`, `live_started_at`, `allow_free_entry` and a single global `schedule_time`; the app currently ignores all of them and derives state from `starts_at` + `duration_minutes`. A staged additive migration adds a per-day map (`schedule_times jsonb`, e.g. `{"1":"16:00","2":"17:00","4":"18:00"}`) so each day keeps its own time, leaves the legacy columns untouched, and extends `live_public_session` to return the new map. This applies when the draft is accepted, so the new field only carries data after that.

**Reads.** `SESSION_COLUMNS` gains `schedule_days`, `schedule_times`, `is_live`, `live_started_at`, `allow_free_entry`. Broadcast links stay public information for a public room and continue to be read through the existing public-session function — no credential gating is added or removed beyond what exists.

**Lifecycle.** `scheduleStateOf` is replaced by two independent derivations: `isTeaching` (from `is_live`) and `nextTeachingTime` (computed from the day/time map, used for display only). Nothing computes "ended". Room `status` stays `published` for the room's whole life.

**Resolution.** `/live/join/:code` and `/live/s/:id` resolve any non-deleted room. When `is_live` is false they render the new Broadcast Information page; when true, and free entry is on, they mount the existing participant dashboard directly with no approval step. "Session not found" is reserved for a code that truly does not exist.

**Teacher control.** `startTeaching` / `stopTeaching` helpers set `is_live` and `live_started_at`; the Live Room Card and the session dashboard header expose the toggle with a live badge. Stopping never deletes the room or its schedule.

**Create vs Settings.** The create form becomes a shared `LiveRoomForm`. `/live/sessions/create` submits `createSession`; `/live/sessions/:id/settings` loads the row into the same form and submits an update, including broadcasts and the day/time map.

**Community.** The community Live card shows broadcast name, subject, each teaching day with its time, platform and status, linking to the permanent room link.

**Not touched.** SmartBoard sync, Smart Cards, Challenges, group games, gallery, reports, assessments and adventure flows keep their current behaviour.
