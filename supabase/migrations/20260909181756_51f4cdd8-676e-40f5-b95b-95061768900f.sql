-- BUILDING GALLERY — two sources of complete buildings.
--
-- The official gallery is published by the platform owner, co-admins and
-- whitelisted asset managers. The community gallery is published by any owner
-- who shares their own modified building. Both point at a TEMPLATE building
-- (a frozen clone), so using or editing a gallery building can never touch the
-- publisher's own working building.

create table if not exists public.building_gallery_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.building_gallery_categories to authenticated;
grant insert, update, delete on public.building_gallery_categories to authenticated;
grant all on public.building_gallery_categories to service_role;

alter table public.building_gallery_categories enable row level security;

create policy "gallery categories are readable"
  on public.building_gallery_categories for select to authenticated using (true);

create policy "gallery categories are managed by platform staff"
  on public.building_gallery_categories for all to authenticated
  using (
    public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
    or public.can_manage_gpl_assets()
  )
  with check (
    public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
    or public.can_manage_gpl_assets()
  );

create table if not exists public.building_gallery_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'official',
  name text not null,
  description text,
  category_slug text not null references public.building_gallery_categories(slug) on update cascade,
  template_building_id uuid not null references public.buildings(id) on delete cascade,
  publisher_id uuid not null,
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint building_gallery_entries_kind_check check (kind in ('official', 'community'))
);

create index if not exists building_gallery_entries_browse_idx
  on public.building_gallery_entries (kind, category_slug, published_at desc);

grant select, insert, update, delete on public.building_gallery_entries to authenticated;
grant all on public.building_gallery_entries to service_role;

alter table public.building_gallery_entries enable row level security;

create policy "published gallery buildings are readable"
  on public.building_gallery_entries for select to authenticated
  using (
    published
    or publisher_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
  );

create policy "official entries are published by platform staff"
  on public.building_gallery_entries for insert to authenticated
  with check (
    publisher_id = auth.uid()
    and (
      kind = 'community'
      or public.has_role(auth.uid(), 'platform_owner')
      or public.has_role(auth.uid(), 'co_admin')
      or public.can_manage_gpl_assets()
    )
  );

create policy "publishers maintain their own entries"
  on public.building_gallery_entries for update to authenticated
  using (
    publisher_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
  )
  with check (
    publisher_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
  );

create policy "publishers remove their own entries"
  on public.building_gallery_entries for delete to authenticated
  using (
    publisher_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
  );

-- Attribution: which gallery building a workspace copied, and when.
create table if not exists public.building_gallery_uses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.building_gallery_entries(id) on delete cascade,
  user_id uuid not null,
  building_id uuid not null references public.buildings(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists building_gallery_uses_entry_idx
  on public.building_gallery_uses (entry_id, created_at desc);

grant select, insert on public.building_gallery_uses to authenticated;
grant all on public.building_gallery_uses to service_role;

alter table public.building_gallery_uses enable row level security;

create policy "people see their own gallery use"
  on public.building_gallery_uses for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner')
    or public.has_role(auth.uid(), 'co_admin')
  );

create policy "people record their own gallery use"
  on public.building_gallery_uses for insert to authenticated
  with check (user_id = auth.uid());

-- A template building is never the workspace's active building.
create index if not exists buildings_source_idx on public.buildings (source_building_id);

insert into public.building_gallery_categories (slug, name, position) values
  ('modern', 'Modern Buildings', 1),
  ('school', 'School Buildings', 2),
  ('ancient', 'Ancient Buildings', 3),
  ('futuristic', 'Futuristic Buildings', 4),
  ('science', 'Science Buildings', 5),
  ('office', 'Office Buildings', 6)
on conflict (slug) do nothing;