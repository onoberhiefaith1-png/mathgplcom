
-- Notebooks
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  teacher text not null default '',
  class_name text not null default '',
  session text not null default '',
  subject text not null default 'Mathematics',
  color_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebooks_owner_idx on public.notebooks(owner_id, updated_at desc);
alter table public.notebooks enable row level security;

create policy "owner read notebooks" on public.notebooks for select using (auth.uid() = owner_id);
create policy "owner insert notebooks" on public.notebooks for insert with check (auth.uid() = owner_id);
create policy "owner update notebooks" on public.notebooks for update using (auth.uid() = owner_id);
create policy "owner delete notebooks" on public.notebooks for delete using (auth.uid() = owner_id);

-- Section kinds
create type public.section_kind as enum ('introduction','explanation','example','exercise','classwork','homework','summary');
create type public.block_kind as enum ('problem','solution','reasoning','text');

-- Sections
create table public.notebook_sections (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  kind public.section_kind not null,
  title text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index notebook_sections_nb_idx on public.notebook_sections(notebook_id, order_index);
alter table public.notebook_sections enable row level security;

create policy "owner all sections" on public.notebook_sections for all
  using (exists (select 1 from public.notebooks n where n.id = notebook_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from public.notebooks n where n.id = notebook_id and n.owner_id = auth.uid()));

-- Subsections
create table public.notebook_subsections (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.notebook_sections(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index notebook_subsections_sec_idx on public.notebook_subsections(section_id, order_index);
alter table public.notebook_subsections enable row level security;

create policy "owner all subsections" on public.notebook_subsections for all
  using (exists (
    select 1 from public.notebook_sections s
    join public.notebooks n on n.id = s.notebook_id
    where s.id = section_id and n.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.notebook_sections s
    join public.notebooks n on n.id = s.notebook_id
    where s.id = section_id and n.owner_id = auth.uid()
  ));

-- Blocks
create table public.notebook_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.notebook_sections(id) on delete cascade,
  subsection_id uuid references public.notebook_subsections(id) on delete cascade,
  kind public.block_kind not null,
  content_ascii text not null default '',
  content_json jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebook_blocks_sec_idx on public.notebook_blocks(section_id, order_index);
create index notebook_blocks_subsec_idx on public.notebook_blocks(subsection_id, order_index);
alter table public.notebook_blocks enable row level security;

create policy "owner all blocks" on public.notebook_blocks for all
  using (exists (
    select 1 from public.notebook_sections s
    join public.notebooks n on n.id = s.notebook_id
    where s.id = section_id and n.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.notebook_sections s
    join public.notebooks n on n.id = s.notebook_id
    where s.id = section_id and n.owner_id = auth.uid()
  ));

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_notebooks_touch before update on public.notebooks
  for each row execute function public.touch_updated_at();
create trigger trg_blocks_touch before update on public.notebook_blocks
  for each row execute function public.touch_updated_at();
