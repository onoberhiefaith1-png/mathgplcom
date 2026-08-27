-- MathGPL Live — public audience access.
--
-- The audience arrives through an invite link and never registers. Everything
-- they can reach is exposed through security-definer functions scoped to one
-- public session, so no table is opened to anonymous readers.

-- 1. Free entry switch -------------------------------------------------------
alter table public.sessions
  add column if not exists allow_free_entry boolean not null default true;

-- 2. Guest entry queue (used only when free entry is off) --------------------
create table if not exists public.live_entry_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  guest_token text not null,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, guest_token)
);

create index if not exists live_entry_requests_session_idx
  on public.live_entry_requests (session_id, status);

grant select, update, delete on public.live_entry_requests to authenticated;
grant all on public.live_entry_requests to service_role;

alter table public.live_entry_requests enable row level security;

drop policy if exists "Session owner reads entry requests" on public.live_entry_requests;
create policy "Session owner reads entry requests"
on public.live_entry_requests
for select
to authenticated
using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

drop policy if exists "Session owner decides entry requests" on public.live_entry_requests;
create policy "Session owner decides entry requests"
on public.live_entry_requests
for update
to authenticated
using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

-- 3. Notes the teacher makes visible to the audience of one session ----------
create table if not exists public.session_public_notes (
  session_id uuid not null references public.sessions(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, notebook_id)
);

grant select, insert, delete on public.session_public_notes to authenticated;
grant all on public.session_public_notes to service_role;

alter table public.session_public_notes enable row level security;

drop policy if exists "Session owner manages audience notes" on public.session_public_notes;
create policy "Session owner manages audience notes"
on public.session_public_notes
for all
to authenticated
using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

-- 4. Public read paths -------------------------------------------------------
-- A session is public to the audience only while it is shared and live.
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
      and s.status in ('published', 'live', 'ended')
  )
$$;

create or replace function public.live_public_session(_session_id uuid)
returns table (
  id uuid, title text, description text, starts_at timestamptz,
  duration_minutes integer, time_zone text, status text,
  ask_participant_name boolean, allow_free_entry boolean, broadcasts jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.description, s.starts_at, s.duration_minutes, s.time_zone,
         s.status, s.ask_participant_name, s.allow_free_entry, s.broadcasts
  from public.sessions s
  where s.id = _session_id
    and s.visibility = 'public'
    and s.status in ('published', 'live', 'ended')
$$;

-- Entry: free entry admits immediately, otherwise a request is queued.
create or replace function public.live_request_entry(
  _session_id uuid, _guest_token text, _display_name text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _free boolean;
  _status text;
begin
  select allow_free_entry into _free
  from public.sessions
  where id = _session_id
    and visibility = 'public'
    and status in ('published', 'live', 'ended');

  if _free is null then
    return 'unavailable';
  end if;

  if _free then
    return 'approved';
  end if;

  insert into public.live_entry_requests (session_id, guest_token, display_name)
  values (_session_id, _guest_token, _display_name)
  on conflict (session_id, guest_token)
    do update set display_name = coalesce(excluded.display_name, live_entry_requests.display_name),
                  updated_at = now()
  returning status into _status;

  return _status;
end;
$$;

create or replace function public.live_entry_status(_session_id uuid, _guest_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _free boolean;
  _status text;
begin
  select allow_free_entry into _free
  from public.sessions
  where id = _session_id
    and visibility = 'public'
    and status in ('published', 'live', 'ended');

  if _free is null then return 'unavailable'; end if;
  if _free then return 'approved'; end if;

  select status into _status
  from public.live_entry_requests
  where session_id = _session_id and guest_token = _guest_token;

  return coalesce(_status, 'none');
end;
$$;

-- Notes: only what the teacher published to this session's audience.
create or replace function public.live_public_notes(_session_id uuid)
returns table (id uuid, title text, subject text, subtopic text, color_index integer, cover_config jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.title, n.subject, n.subtopic, n.color_index, n.cover_config
  from public.session_public_notes p
  join public.notebooks n on n.id = p.notebook_id
  where p.session_id = _session_id
    and public.live_session_is_public(_session_id)
  order by n.title
$$;

create or replace function public.live_public_note(_session_id uuid, _notebook_id uuid)
returns table (id uuid, title text, teacher text, subject text, subtopic text, document_json jsonb, paper_style text, paper_size text, cover_config jsonb, color_index integer)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.title, n.teacher, n.subject, n.subtopic, n.document_json,
         n.paper_style, n.paper_size, n.cover_config, n.color_index
  from public.session_public_notes p
  join public.notebooks n on n.id = p.notebook_id
  where p.session_id = _session_id
    and p.notebook_id = _notebook_id
    and public.live_session_is_public(_session_id)
$$;

-- Challenges (Assignments) and Game Challenges (Adventures) of the session.
create or replace function public.live_public_activities(_session_id uuid)
returns table (id uuid, kind text, title text, notebook_id uuid, game_id uuid, status text, due_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id,
         case when a.mode = 'adventure' then 'game_challenge' else 'challenge' end as kind,
         a.title, a.notebook_id, a.game_id, a.status, a.due_at
  from public.sessions s
  join public.learning_assignments a on a.class_id = s.class_id
  where s.id = _session_id
    and public.live_session_is_public(_session_id)
    and a.archived_at is null
  order by a.created_at desc
$$;

-- The teacher's SmartBoard as the audience watches it.
create or replace function public.live_public_smartboard(_session_id uuid)
returns table (notebook_id uuid, state_json jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.notebook_id, b.state_json, b.updated_at
  from public.sessions s
  join public.class_smartboard_state b on b.class_id = s.class_id
  where s.id = _session_id
    and public.live_session_is_public(_session_id)
$$;

revoke all on function public.live_request_entry(uuid, text, text) from public;
grant execute on function public.live_session_is_public(uuid) to anon, authenticated;
grant execute on function public.live_public_session(uuid) to anon, authenticated;
grant execute on function public.live_request_entry(uuid, text, text) to anon, authenticated;
grant execute on function public.live_entry_status(uuid, text) to anon, authenticated;
grant execute on function public.live_public_notes(uuid) to anon, authenticated;
grant execute on function public.live_public_note(uuid, uuid) to anon, authenticated;
grant execute on function public.live_public_activities(uuid) to anon, authenticated;
grant execute on function public.live_public_smartboard(uuid) to anon, authenticated;
