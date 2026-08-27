-- MathGPL Live — a session is a persistent public teaching room, not a
-- one-time calendar event.
--
-- The recurring day(s) and time are informational scheduling metadata used for
-- display and Community discovery. They never expire the room and never gate
-- access. Whether the room is LIVE is set explicitly by the teacher.

alter table public.sessions
  add column if not exists schedule_days smallint[] not null default '{}',
  add column if not exists schedule_time text,
  add column if not exists is_live boolean not null default false,
  add column if not exists live_started_at timestamptz;

comment on column public.sessions.schedule_days is
  'Recurring teaching days, 0 = Sunday … 6 = Saturday. Informational only.';
comment on column public.sessions.schedule_time is
  'Recurring teaching time as HH:MM in the session time_zone. Informational only.';
comment on column public.sessions.is_live is
  'True only while the teacher is actually teaching. Never derived from the clock.';

-- Existing rows keep their identity: derive a recurring day/time from the old
-- one-time start so nothing loses its schedule information.
update public.sessions
set
  schedule_days = array[extract(dow from starts_at)::smallint],
  schedule_time = to_char(starts_at, 'HH24:MI')
where starts_at is not null
  and (schedule_days is null or schedule_days = '{}');
