create table if not exists public.page_guides (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text,
  description text,
  video_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.page_guides to anon;
grant select, insert, update, delete on public.page_guides to authenticated;
grant all on public.page_guides to service_role;

alter table public.page_guides enable row level security;

create policy "published guides are readable"
  on public.page_guides for select
  using (status = 'published' or public.has_capability('platform_admin'));

create policy "administrators create guides"
  on public.page_guides for insert to authenticated
  with check (public.has_capability('platform_admin'));

create policy "administrators update guides"
  on public.page_guides for update to authenticated
  using (public.has_capability('platform_admin'))
  with check (public.has_capability('platform_admin'));

create policy "administrators delete guides"
  on public.page_guides for delete to authenticated
  using (public.has_capability('platform_admin'));

create or replace function public.page_guides_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists page_guides_touch on public.page_guides;
create trigger page_guides_touch
  before update on public.page_guides
  for each row execute function public.page_guides_touch();

create policy "guide videos are readable"
  on storage.objects for select
  using (bucket_id = 'page-guides');

create policy "administrators upload guide videos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'page-guides' and public.has_capability('platform_admin'));

create policy "administrators replace guide videos"
  on storage.objects for update to authenticated
  using (bucket_id = 'page-guides' and public.has_capability('platform_admin'));

create policy "administrators delete guide videos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'page-guides' and public.has_capability('platform_admin'));