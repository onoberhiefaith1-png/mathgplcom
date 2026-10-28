-- Keep public join links visible while preventing anonymous reads of meeting codes/passwords.

revoke select on table public.sessions from anon;

grant select (
  id, owner_id, class_id, notebook_id, title, description, starts_at,
  duration_minutes, time_zone, visibility, status, created_at, updated_at,
  ask_participant_name, allow_free_entry, schedule_days, schedule_time,
  is_live, live_started_at
) on table public.sessions to anon;

drop function if exists public.live_public_session(uuid);

create function public.live_public_session(_session_id uuid)
returns table (
  id uuid, title text, description text, starts_at timestamptz,
  duration_minutes integer, time_zone text, status text,
  ask_participant_name boolean, allow_free_entry boolean, broadcasts jsonb,
  schedule_days smallint[], schedule_time text, is_live boolean,
  live_started_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.description, s.starts_at, s.duration_minutes, s.time_zone,
         s.status, s.ask_participant_name, s.allow_free_entry,
         coalesce((
           select jsonb_agg(
             jsonb_strip_nulls(
               jsonb_build_object(
                 'id', entry.value ->> 'id',
                 'platform', entry.value ->> 'platform',
                 'customName', entry.value ->> 'customName',
                 'link', entry.value ->> 'link',
                 'note', entry.value ->> 'note'
               )
             )
           )
           from jsonb_array_elements(coalesce(s.broadcasts, '[]'::jsonb)) as entry(value)
         ), '[]'::jsonb) as broadcasts,
         s.schedule_days, s.schedule_time, s.is_live, s.live_started_at
  from public.sessions s
  where s.id = _session_id
    and s.visibility = 'public'
    and s.status in ('published', 'live', 'ended')
$$;

create or replace function public.live_admitted_broadcast_credentials(
  _session_id uuid,
  _guest_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', entry.value ->> 'id',
          'code', entry.value ->> 'code',
          'password', entry.value ->> 'password'
        )
      )
    )
    from public.sessions s
    cross join lateral jsonb_array_elements(coalesce(s.broadcasts, '[]'::jsonb)) as entry(value)
    where s.id = _session_id
      and s.visibility = 'public'
      and s.status in ('published', 'live', 'ended')
      and (
        s.allow_free_entry
        or exists (
          select 1
          from public.live_entry_requests r
          where r.session_id = s.id
            and r.guest_token = _guest_token
            and r.status = 'approved'
        )
        or exists (
          select 1
          from public.session_audience a
          where a.session_id = s.id
            and a.guest_token = _guest_token
            and a.status = 'approved'
        )
      )
  ), '[]'::jsonb)
$$;

grant execute on function public.live_public_session(uuid) to anon, authenticated;
grant execute on function public.live_admitted_broadcast_credentials(uuid, text) to anon, authenticated;

revoke all on function public.live_public_session(uuid) from public;
revoke all on function public.live_admitted_broadcast_credentials(uuid, text) from public;
grant execute on function public.live_public_session(uuid) to anon, authenticated;
grant execute on function public.live_admitted_broadcast_credentials(uuid, text) to anon, authenticated;