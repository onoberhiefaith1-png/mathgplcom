create table if not exists public.class_adventures (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unique (class_id, game_id)
);

grant select, insert, update, delete on public.class_adventures to authenticated;
grant all on public.class_adventures to service_role;

alter table public.class_adventures enable row level security;

create policy "class_adventures readable by class"
  on public.class_adventures for select to authenticated
  using (
    public.is_class_owner(class_id)
    or (unlinked_at is null and public.is_class_member(class_id))
  );

create policy "class_adventures managed by owner"
  on public.class_adventures for all to authenticated
  using (public.is_class_owner(class_id))
  with check (public.is_class_owner(class_id));

create table if not exists public.adventure_bar_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  progress_element_id text not null,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  section_id uuid not null references public.notebook_sections(id) on delete cascade,
  question_key uuid,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unassigned_at timestamptz,
  foreign key (class_id, game_id)
    references public.class_adventures(class_id, game_id)
    on delete restrict
);

create unique index if not exists adventure_bar_questions_unique_question
  on public.adventure_bar_questions (
    class_id,
    game_id,
    progress_element_id,
    coalesce(question_key, section_id)
  );

create index if not exists adventure_bar_questions_bar_idx
  on public.adventure_bar_questions (class_id, game_id, progress_element_id);

grant select, insert, update, delete on public.adventure_bar_questions to authenticated;
grant all on public.adventure_bar_questions to service_role;

alter table public.adventure_bar_questions enable row level security;

create policy "adventure_bar_questions readable by class"
  on public.adventure_bar_questions for select to authenticated
  using (
    public.is_class_owner(class_id)
    or (
      public.is_class_member(class_id)
      and exists (
        select 1
        from public.class_adventures ca
        where ca.class_id = adventure_bar_questions.class_id
          and ca.game_id = adventure_bar_questions.game_id
          and ca.unlinked_at is null
      )
    )
  );

create policy "adventure_bar_questions managed by owner"
  on public.adventure_bar_questions for all to authenticated
  using (public.is_class_owner(class_id))
  with check (
    public.is_class_owner(class_id)
    and exists (
      select 1
      from public.class_adventures ca
      where ca.class_id = adventure_bar_questions.class_id
        and ca.game_id = adventure_bar_questions.game_id
        and ca.unlinked_at is null
    )
  );

alter table public.class_game_boards
  add column if not exists pass_pct integer
  check (pass_pct is null or pass_pct between 0 and 100);

insert into public.class_adventures (class_id, game_id, created_at)
select distinct b.class_id, b.game_id, min(b.created_at) over (partition by b.class_id, b.game_id)
from public.class_game_boards b
on conflict (class_id, game_id) do nothing;

insert into public.adventure_bar_questions (
  class_id, game_id, progress_element_id, notebook_id, section_id, question_key, created_at
)
select
  b.class_id,
  b.game_id,
  b.progress_element_id,
  s.notebook_id,
  s.id,
  s.stable_key,
  b.created_at
from public.class_game_boards b
cross join lateral unnest(b.question_keys) as question_key
join public.notebook_sections s on s.stable_key = question_key
on conflict do nothing;

insert into public.adventure_bar_questions (
  class_id, game_id, progress_element_id, notebook_id, section_id, question_key, created_at
)
select
  b.class_id,
  b.game_id,
  b.progress_element_id,
  s.notebook_id,
  s.id,
  s.stable_key,
  b.created_at
from public.class_game_boards b
join public.notebook_sections s on s.id = b.section_id
where cardinality(b.question_keys) = 0
on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'class_adventures'
  ) then
    alter publication supabase_realtime add table public.class_adventures;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'adventure_bar_questions'
  ) then
    alter publication supabase_realtime add table public.adventure_bar_questions;
  end if;
end $$;

notify pgrst, 'reload schema';