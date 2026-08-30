-- Community — public people directory (phase 1)
--
-- Community profiles become public, professional profiles. Everything is
-- additive: the existing username/bio columns keep working untouched.

alter table public.community_profiles
  add column if not exists is_listed boolean not null default false,
  add column if not exists role_kind text,
  add column if not exists display_name text,
  add column if not exists headline text,
  add column if not exists location text,
  add column if not exists country text,
  add column if not exists avatar_url text,
  add column if not exists bio_long text,
  add column if not exists years_experience integer,
  add column if not exists professional jsonb not null default '{}'::jsonb,
  add column if not exists moderation_state text not null default 'pending',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists view_count integer not null default 0;

create index if not exists community_profiles_listed_idx
  on public.community_profiles (is_listed, role_kind);

-- Owner must always be able to read their own row, listed or not, so the
-- workspace editor works before the profile is public.
drop policy if exists "own community profile is readable" on public.community_profiles;
create policy "own community profile is readable"
  on public.community_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

/* -------------------------------------------------------------- page views */

create table if not exists public.community_profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (profile_user_id, viewer_key, viewed_on)
);

grant select, insert on public.community_profile_views to authenticated;
grant all on public.community_profile_views to service_role;

alter table public.community_profile_views enable row level security;

create policy "profile owner reads own view log"
  on public.community_profile_views
  for select
  to authenticated
  using (auth.uid() = profile_user_id);

create index if not exists community_profile_views_profile_idx
  on public.community_profile_views (profile_user_id, viewed_on desc);

/* -------------------------------------------------------------- directory */

-- Anonymous and signed-in discovery both go through these functions, never
-- straight at the table, so only listed rows and a safe projection escape.
create or replace function public.community_directory(
  _role text default null,
  _q text default null,
  _limit integer default 60
)
returns table (
  user_id uuid,
  username text,
  role_kind text,
  display_name text,
  headline text,
  location text,
  country text,
  avatar_url text,
  bio text,
  professional jsonb,
  years_experience integer,
  view_count integer,
  accepts_requests boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      cp.user_id,
      cp.username,
      coalesce(
        cp.role_kind,
        (select ur.role::text from public.user_roles ur where ur.user_id = cp.user_id limit 1)
      ) as role_kind,
      coalesce(nullif(cp.display_name, ''), p.full_name, p.display_name, cp.username) as display_name,
      cp.headline,
      cp.location,
      cp.country,
      coalesce(nullif(cp.avatar_url, ''), p.avatar_url) as avatar_url,
      cp.bio,
      cp.professional,
      cp.years_experience,
      cp.view_count,
      coalesce(p.accepts_requests, true) as accepts_requests
    from public.community_profiles cp
    left join public.profiles p on p.user_id = cp.user_id
    where cp.is_listed = true
      and cp.moderation_state <> 'rejected'
  )
  select
    b.user_id,
    b.username,
    b.role_kind,
    b.display_name,
    b.headline,
    -- Students never expose where they live.
    case when b.role_kind = 'student' then null else b.location end,
    case when b.role_kind = 'student' then null else b.country end,
    b.avatar_url,
    b.bio,
    b.professional,
    b.years_experience,
    b.view_count,
    b.accepts_requests
  from base b
  where (_role is null or b.role_kind = _role)
    and (
      _q is null or btrim(_q) = '' or
      b.username ilike '%' || _q || '%' or
      coalesce(b.display_name, '') ilike '%' || _q || '%' or
      coalesce(b.headline, '') ilike '%' || _q || '%' or
      coalesce(b.location, '') ilike '%' || _q || '%' or
      coalesce(b.bio, '') ilike '%' || _q || '%' or
      b.professional::text ilike '%' || _q || '%'
    )
  order by b.view_count desc, b.username asc
  limit least(coalesce(_limit, 60), 200);
$$;

grant execute on function public.community_directory(text, text, integer) to anon, authenticated;

create or replace function public.community_public_profile(_username text)
returns table (
  user_id uuid,
  username text,
  role_kind text,
  display_name text,
  headline text,
  location text,
  country text,
  avatar_url text,
  bio text,
  bio_long text,
  professional jsonb,
  years_experience integer,
  view_count integer,
  accepts_requests boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.user_id,
    cp.username,
    coalesce(
      cp.role_kind,
      (select ur.role::text from public.user_roles ur where ur.user_id = cp.user_id limit 1)
    ) as role_kind,
    coalesce(nullif(cp.display_name, ''), p.full_name, p.display_name, cp.username),
    cp.headline,
    case
      when coalesce(cp.role_kind, '') = 'student' then null
      else cp.location
    end,
    case
      when coalesce(cp.role_kind, '') = 'student' then null
      else cp.country
    end,
    coalesce(nullif(cp.avatar_url, ''), p.avatar_url),
    cp.bio,
    cp.bio_long,
    cp.professional,
    cp.years_experience,
    cp.view_count,
    coalesce(p.accepts_requests, true)
  from public.community_profiles cp
  left join public.profiles p on p.user_id = cp.user_id
  where lower(cp.username) = lower(btrim(_username))
    and cp.is_listed = true
    and cp.moderation_state <> 'rejected'
  limit 1;
$$;

grant execute on function public.community_public_profile(text) to anon, authenticated;

-- One counted view per viewer per profile per day.
create or replace function public.community_profile_viewed(_username text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target uuid;
  key text;
  fresh boolean := false;
  total integer;
begin
  select cp.user_id into target
  from public.community_profiles cp
  where lower(cp.username) = lower(btrim(_username)) and cp.is_listed = true
  limit 1;

  if target is null then
    return 0;
  end if;

  key := coalesce(auth.uid()::text, 'anon');

  insert into public.community_profile_views (profile_user_id, viewer_key)
  values (target, key)
  on conflict (profile_user_id, viewer_key, viewed_on) do nothing;

  fresh := found;

  if fresh then
    update public.community_profiles
      set view_count = view_count + 1
      where user_id = target
      returning view_count into total;
  else
    select view_count into total from public.community_profiles where user_id = target;
  end if;

  return coalesce(total, 0);
end;
$$;

grant execute on function public.community_profile_viewed(text) to anon, authenticated;
