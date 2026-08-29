-- Join Class upgrade + shared teaching Schedule system.
--
-- A Class now carries the same "when and where" information a Live room does
-- (teaching days with start/end time, time zone, online platforms) plus a new
-- physical Classroom option. The dated teaching plan ("what will be taught")
-- lives in one table shared by Class and Live Session.

alter table public.classes
  add column if not exists schedule_days smallint[] not null default '{}',
  add column if not exists schedule_times jsonb not null default '{}'::jsonb,
  add column if not exists schedule_end_times jsonb not null default '{}'::jsonb,
  add column if not exists time_zone text,
  add column if not exists broadcasts jsonb not null default '[]'::jsonb,
  add column if not exists venue_kind text not null default 'online',
  add column if not exists venue_address text,
  add column if not exists venue_details text;

-- Sessions already have per-day start times; give them an end time too.
alter table public.sessions
  add column if not exists schedule_end_times jsonb not null default '{}'::jsonb;

create table if not exists public.teaching_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- 'class' → scope_id is a classes.id, 'session' → scope_id is a sessions.id
  scope text not null check (scope in ('class', 'session')),
  scope_id uuid not null,
  entry_date date,
  week_label text,
  topic text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teaching_schedule_entries_scope_idx
  on public.teaching_schedule_entries (scope, scope_id, entry_date);
create index if not exists teaching_schedule_entries_owner_idx
  on public.teaching_schedule_entries (owner_id);

grant select, insert, update, delete on public.teaching_schedule_entries to authenticated;
grant select on public.teaching_schedule_entries to anon;
grant all on public.teaching_schedule_entries to service_role;

alter table public.teaching_schedule_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teaching_schedule_entries'
      and policyname = 'Owners manage their schedule entries'
  ) then
    create policy "Owners manage their schedule entries"
      on public.teaching_schedule_entries
      for all
      to authenticated
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teaching_schedule_entries'
      and policyname = 'Class members read the class teaching plan'
  ) then
    create policy "Class members read the class teaching plan"
      on public.teaching_schedule_entries
      for select
      to authenticated
      using (scope = 'class' and public.is_class_member(scope_id));
  end if;

  -- A public Live room's teaching plan is public information: it says what will
  -- be taught, never anything private about the room or its audience.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'teaching_schedule_entries'
      and policyname = 'Anyone reads a public room teaching plan'
  ) then
    create policy "Anyone reads a public room teaching plan"
      on public.teaching_schedule_entries
      for select
      to anon, authenticated
      using (
        scope = 'session'
        and exists (
          select 1 from public.sessions s
          where s.id = scope_id and s.visibility = 'public'
        )
      );
  end if;
end $$;

create or replace function public.teaching_schedule_entries_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists teaching_schedule_entries_touch on public.teaching_schedule_entries;
create trigger teaching_schedule_entries_touch
  before update on public.teaching_schedule_entries
  for each row execute function public.teaching_schedule_entries_touch();