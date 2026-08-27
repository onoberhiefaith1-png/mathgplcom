drop function if exists public.live_public_session(uuid);

create function public.live_public_session(_session_id uuid)
returns table (
  id uuid, class_id uuid, notebook_id uuid, title text, description text,
  starts_at timestamptz, duration_minutes integer, time_zone text, status text,
  ask_participant_name boolean, allow_free_entry boolean, broadcasts jsonb,
  schedule_days smallint[], schedule_time text, is_live boolean,
  live_started_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.class_id, s.notebook_id, s.title, s.description, s.starts_at,
         s.duration_minutes, s.time_zone, s.status, s.ask_participant_name,
         s.allow_free_entry,
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
         ), '[]'::jsonb),
         s.schedule_days, s.schedule_time, s.is_live, s.live_started_at
  from public.sessions s
  where s.id = _session_id
    and s.visibility = 'public'
    and s.status in ('published', 'live', 'ended')
$$;

revoke all on function public.live_public_session(uuid) from public;
grant execute on function public.live_public_session(uuid) to anon, authenticated;