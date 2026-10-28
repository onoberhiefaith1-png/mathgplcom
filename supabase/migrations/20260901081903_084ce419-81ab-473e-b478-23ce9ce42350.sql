-- Global tutorial videos: many videos per page, managed by platform
-- administrators AND Asset Managers.

create or replace function public.can_manage_tutorials()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_capability('platform_admin')
     or exists (select 1 from public.asset_managers m where m.user_id = auth.uid())
$$;

revoke all on function public.can_manage_tutorials() from public;
grant execute on function public.can_manage_tutorials() to anon, authenticated, service_role;

create table if not exists public.page_guide_videos (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  title text,
  description text,
  video_path text not null,
  duration_seconds numeric,
  position integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published')),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_guide_videos_page_key_idx
  on public.page_guide_videos (page_key, position);

grant select on public.page_guide_videos to anon;
grant select, insert, update, delete on public.page_guide_videos to authenticated;
grant all on public.page_guide_videos to service_role;

alter table public.page_guide_videos enable row level security;

create policy "published tutorials are readable"
  on public.page_guide_videos for select
  using (status = 'published' or public.can_manage_tutorials());

create policy "managers create tutorials"
  on public.page_guide_videos for insert to authenticated
  with check (public.can_manage_tutorials());

create policy "managers update tutorials"
  on public.page_guide_videos for update to authenticated
  using (public.can_manage_tutorials())
  with check (public.can_manage_tutorials());

create policy "managers delete tutorials"
  on public.page_guide_videos for delete to authenticated
  using (public.can_manage_tutorials());

drop trigger if exists page_guide_videos_touch on public.page_guide_videos;
create trigger page_guide_videos_touch
  before update on public.page_guide_videos
  for each row execute function public.page_guides_touch();

-- Asset Managers gain the same rights on the legacy single-guide table and on
-- the video bucket. Existing administrator policies stay untouched.
create policy "managers create guides"
  on public.page_guides for insert to authenticated
  with check (public.can_manage_tutorials());

create policy "managers update guides"
  on public.page_guides for update to authenticated
  using (public.can_manage_tutorials())
  with check (public.can_manage_tutorials());

create policy "managers delete guides"
  on public.page_guides for delete to authenticated
  using (public.can_manage_tutorials());

create policy "managers upload tutorial videos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'page-guides' and public.can_manage_tutorials());

create policy "managers replace tutorial videos"
  on storage.objects for update to authenticated
  using (bucket_id = 'page-guides' and public.can_manage_tutorials());

create policy "managers delete tutorial videos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'page-guides' and public.can_manage_tutorials());