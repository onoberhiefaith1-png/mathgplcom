-- Broadcast entries can carry meeting links and passwords, so anonymous
-- audience links must never be able to read that column straight off the row.
revoke select on public.sessions from anon;
revoke select on public.sessions from authenticated;

grant select (
  id,
  owner_id,
  class_id,
  notebook_id,
  title,
  description,
  starts_at,
  duration_minutes,
  time_zone,
  visibility,
  status,
  created_at,
  updated_at,
  ask_participant_name
) on public.sessions to anon;

grant select (
  id,
  owner_id,
  class_id,
  notebook_id,
  title,
  description,
  starts_at,
  duration_minutes,
  time_zone,
  visibility,
  status,
  created_at,
  updated_at,
  ask_participant_name
) on public.sessions to authenticated;

-- Public discovery policies can still expose only the safe columns above;
-- they can no longer be used to request broadcasts or the private join code.
drop policy if exists "Audience links read open sessions" on public.sessions;

-- Audience members get the broadcast details only once the session is open
-- (no scheduled start, or the start time has passed). Owners always see them.
create or replace function public.live_session_broadcasts(_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.owner_id = auth.uid() then coalesce(s.broadcasts, '[]'::jsonb)
    when (s.starts_at is null or now() >= s.starts_at)
      and (
        public.is_class_member(s.class_id)
        or (
          s.visibility = 'public'
          and s.status = any (array['published', 'live', 'ended'])
        )
      )
      then coalesce(s.broadcasts, '[]'::jsonb)
    else '[]'::jsonb
  end
  from public.sessions s
  where s.id = _session_id
    and (
      s.owner_id = auth.uid()
      or public.is_class_member(s.class_id)
      or (
        s.visibility = 'public'
        and s.status = any (array['published', 'live', 'ended'])
      )
    )
$$;

grant execute on function public.live_session_broadcasts(uuid) to anon, authenticated;
