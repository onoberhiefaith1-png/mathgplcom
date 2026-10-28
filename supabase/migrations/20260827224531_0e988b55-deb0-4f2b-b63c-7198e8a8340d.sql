-- 1. Per-day teaching times -------------------------------------------------
alter table public.sessions
  add column if not exists schedule_times jsonb not null default '{}'::jsonb;

update public.sessions s
set schedule_times = (
  select coalesce(jsonb_object_agg(d::text, s.schedule_time), '{}'::jsonb)
  from unnest(coalesce(s.schedule_days, '{}'::smallint[])) as d
)
where s.schedule_time is not null
  and (s.schedule_times is null or s.schedule_times = '{}'::jsonb);

-- 2. Guests and unrelated users read rooms only through the safe RPC ---------
drop policy if exists "Audience links read open sessions" on public.sessions;
drop policy if exists "Audience links read shared public sessions" on public.sessions;
drop policy if exists "Anyone signed in can view public published sessions" on public.sessions;

revoke select on table public.sessions from anon;

-- 3. Public room information (permanent, never expiring) ---------------------
drop function if exists public.live_admitted_broadcast_credentials(uuid, text);
drop function if exists public.live_public_session(uuid);

create function public.live_public_session(_session_id uuid)
returns table (
  id uuid, class_id uuid, notebook_id uuid, title text, description text,
  teacher_name text, subject text, subtopic text,
  starts_at timestamptz, duration_minutes integer, time_zone text, status text,
  ask_participant_name boolean, allow_free_entry boolean, broadcasts jsonb,
  schedule_days smallint[], schedule_time text, schedule_times jsonb,
  is_live boolean, live_started_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.class_id, s.notebook_id, s.title, s.description,
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), 'Teacher'),
         n.subject, n.subtopic,
         s.starts_at, s.duration_minutes, s.time_zone, s.status,
         s.ask_participant_name, s.allow_free_entry,
         -- A Live room is a public broadcast: the platform details the teacher
         -- published are advertising, not private credentials.
         coalesce(s.broadcasts, '[]'::jsonb),
         s.schedule_days, s.schedule_time, coalesce(s.schedule_times, '{}'::jsonb),
         s.is_live, s.live_started_at
  from public.sessions s
  left join public.profiles p on p.user_id = s.owner_id
  left join public.notebooks n on n.id = s.notebook_id
  where s.id = _session_id
    and s.visibility = 'public'
$$;

revoke all on function public.live_public_session(uuid) from public;
grant execute on function public.live_public_session(uuid) to anon, authenticated;

-- 4. Teacher edits the per-day schedule of a permanent room -----------------
create or replace function public.live_session_is_public(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = _session_id
      and s.visibility = 'public'
  )
$$;