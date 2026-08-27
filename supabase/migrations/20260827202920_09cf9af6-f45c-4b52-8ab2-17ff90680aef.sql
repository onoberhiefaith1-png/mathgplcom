-- MathGPL Live — audience access layer.
alter table public.sessions
  add column if not exists allow_free_entry boolean not null default true;

create table if not exists public.session_audience (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  guest_token text not null,
  display_name text,
  status text not null default 'waiting',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, guest_token),
  constraint session_audience_status_check check (status in ('waiting', 'approved', 'removed'))
);

create index if not exists session_audience_session_idx on public.session_audience (session_id);

grant select, insert, update on public.session_audience to anon;
grant select, insert, update, delete on public.session_audience to authenticated;
grant all on public.session_audience to service_role;

alter table public.session_audience enable row level security;

create or replace function public.session_is_open(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = _session_id and s.status in ('published', 'live')
  )
$$;

create or replace function public.session_owner_is(_session_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = _session_id and s.owner_id = _user_id
  )
$$;

create or replace function public.class_has_open_live_session(_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    where s.class_id = _class_id and s.status in ('published', 'live')
  )
$$;

grant execute on function public.session_is_open(uuid) to anon, authenticated;
grant execute on function public.session_owner_is(uuid, uuid) to anon, authenticated;
grant execute on function public.class_has_open_live_session(uuid) to anon, authenticated;

drop policy if exists "Audience joins an open session" on public.session_audience;
create policy "Audience joins an open session"
on public.session_audience for insert to anon, authenticated
with check (public.session_is_open(session_id) and status in ('waiting', 'approved'));

drop policy if exists "Audience reads the roll of an open session" on public.session_audience;
create policy "Audience reads the roll of an open session"
on public.session_audience for select to anon, authenticated
using (public.session_is_open(session_id));

drop policy if exists "Audience keeps its own row alive" on public.session_audience;
create policy "Audience keeps its own row alive"
on public.session_audience for update to anon, authenticated
using (public.session_is_open(session_id))
with check (public.session_is_open(session_id));

drop policy if exists "Session owner manages the audience" on public.session_audience;
create policy "Session owner manages the audience"
on public.session_audience for all to authenticated
using (public.session_owner_is(session_id, auth.uid()))
with check (public.session_owner_is(session_id, auth.uid()));

do $$
begin
  begin
    alter publication supabase_realtime add table public.session_audience;
  exception when duplicate_object then null;
  end;
end $$;

grant select on public.classes to anon;
grant select on public.class_smartboard_state to anon;
grant select on public.class_lesson_notes to anon;
grant select on public.notebooks to anon;
grant select on public.notebook_sections to anon;
grant select on public.notebook_subsections to anon;
grant select on public.notebook_blocks to anon;
grant select on public.learning_assignments to anon;

drop policy if exists "Audience reads the live session class" on public.classes;
create policy "Audience reads the live session class"
on public.classes for select to anon
using (public.class_has_open_live_session(id));

drop policy if exists "Audience reads the live board" on public.class_smartboard_state;
create policy "Audience reads the live board"
on public.class_smartboard_state for select to anon
using (
  public.class_has_open_live_session(class_id)
  and exists (
    select 1 from public.classes c
    where c.id = class_id and c.smartboard_visibility = 'student_access_enabled'
  )
);

drop policy if exists "Audience reads shared session notes" on public.class_lesson_notes;
create policy "Audience reads shared session notes"
on public.class_lesson_notes for select to anon
using (public.class_has_open_live_session(class_id) and visibility = 'student_access_enabled');

create or replace function public.notebook_open_to_audience(_notebook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.class_lesson_notes n
      where n.notebook_id = _notebook_id
        and n.visibility = 'student_access_enabled'
        and public.class_has_open_live_session(n.class_id)
    )
    or exists (
      select 1 from public.class_smartboard_state b
      where b.notebook_id = _notebook_id
        and public.class_has_open_live_session(b.class_id)
    )
    or exists (
      select 1 from public.learning_assignments a
      where a.notebook_id = _notebook_id
        and a.status = 'active'
        and public.class_has_open_live_session(a.class_id)
    )
$$;

grant execute on function public.notebook_open_to_audience(uuid) to anon, authenticated;

drop policy if exists "Audience reads open notebooks" on public.notebooks;
create policy "Audience reads open notebooks"
on public.notebooks for select to anon
using (public.notebook_open_to_audience(id));

drop policy if exists "Audience reads open notebook sections" on public.notebook_sections;
create policy "Audience reads open notebook sections"
on public.notebook_sections for select to anon
using (public.notebook_open_to_audience(notebook_id));

drop policy if exists "Audience reads open notebook subsections" on public.notebook_subsections;
create policy "Audience reads open notebook subsections"
on public.notebook_subsections for select to anon
using (
  exists (
    select 1 from public.notebook_sections s
    where s.id = section_id and public.notebook_open_to_audience(s.notebook_id)
  )
);

drop policy if exists "Audience reads open notebook blocks" on public.notebook_blocks;
create policy "Audience reads open notebook blocks"
on public.notebook_blocks for select to anon
using (
  exists (
    select 1 from public.notebook_sections s
    where s.id = section_id and public.notebook_open_to_audience(s.notebook_id)
  )
  or exists (
    select 1 from public.notebook_subsections sub
    join public.notebook_sections s2 on s2.id = sub.section_id
    where sub.id = subsection_id and public.notebook_open_to_audience(s2.notebook_id)
  )
);

drop policy if exists "Audience reads live challenges" on public.learning_assignments;
create policy "Audience reads live challenges"
on public.learning_assignments for select to anon
using (status = 'active' and public.class_has_open_live_session(class_id));