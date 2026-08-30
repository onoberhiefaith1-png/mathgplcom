-- Community network layer
--
-- Community becomes the professional network of MathGPL: richer public
-- profiles (cover media + introduction video), a real post feed with likes and
-- comments, dynamic hashtags, and a live-now rail fed by real sessions.
-- Everything here is additive.

/* ------------------------------------------------------------ profile media */

alter table public.community_profiles
  add column if not exists cover_url text,
  add column if not exists cover_kind text not null default 'image',
  add column if not exists intro_video_url text;

/* -------------------------------------------- discovery functions (widened) */

-- The directory and public-profile readers gain the new media columns. The
-- return type changes, so the previous versions are dropped first.
drop function if exists public.community_directory(text, text, integer);

create function public.community_directory(
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
  cover_url text,
  cover_kind text,
  intro_video_url text,
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
      cp.cover_url,
      cp.cover_kind,
      cp.intro_video_url,
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
    b.cover_url,
    b.cover_kind,
    b.intro_video_url,
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

drop function if exists public.community_public_profile(text);

create function public.community_public_profile(_username text)
returns table (
  user_id uuid,
  username text,
  role_kind text,
  display_name text,
  headline text,
  location text,
  country text,
  avatar_url text,
  cover_url text,
  cover_kind text,
  intro_video_url text,
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
      cp.cover_url,
      cp.cover_kind,
      cp.intro_video_url,
      cp.bio,
      cp.bio_long,
      cp.professional,
      cp.years_experience,
      cp.view_count,
      coalesce(p.accepts_requests, true) as accepts_requests
    from public.community_profiles cp
    left join public.profiles p on p.user_id = cp.user_id
    where cp.is_listed = true
      and cp.moderation_state <> 'rejected'
      and lower(cp.username) = lower(btrim(_username))
  )
  select
    b.user_id,
    b.username,
    b.role_kind,
    b.display_name,
    b.headline,
    case when b.role_kind = 'student' then null else b.location end,
    case when b.role_kind = 'student' then null else b.country end,
    b.avatar_url,
    b.cover_url,
    b.cover_kind,
    b.intro_video_url,
    b.bio,
    b.bio_long,
    b.professional,
    b.years_experience,
    b.view_count,
    b.accepts_requests
  from base b;
$$;

grant execute on function public.community_public_profile(text) to anon, authenticated;

/* --------------------------------------------------------------- live now */

-- Who is teaching right now. Only sessions the owner has made openly
-- available, and only listed Community profiles, ever appear.
create or replace function public.community_live_now(_limit integer default 24)
returns table (
  session_id uuid,
  title text,
  description text,
  started_at timestamptz,
  owner_id uuid,
  username text,
  display_name text,
  headline text,
  avatar_url text,
  role_kind text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.description,
    coalesce(s.live_started_at, s.starts_at),
    s.owner_id,
    cp.username,
    coalesce(nullif(cp.display_name, ''), p.full_name, p.display_name, cp.username),
    cp.headline,
    coalesce(nullif(cp.avatar_url, ''), p.avatar_url),
    coalesce(
      cp.role_kind,
      (select ur.role::text from public.user_roles ur where ur.user_id = s.owner_id limit 1)
    )
  from public.sessions s
  join public.community_profiles cp on cp.user_id = s.owner_id
  left join public.profiles p on p.user_id = s.owner_id
  where s.is_live = true
    and (s.visibility = 'public' or s.allow_free_entry = true)
    and cp.is_listed = true
    and cp.moderation_state <> 'rejected'
  order by coalesce(s.live_started_at, s.starts_at) desc nulls last
  limit least(coalesce(_limit, 24), 100);
$$;

grant execute on function public.community_live_now(integer) to anon, authenticated;

/* ------------------------------------------------- discovery kinds widened */

alter table public.community_resources
  drop constraint if exists community_resources_kind_check;

alter table public.community_resources
  add constraint community_resources_kind_check check (
    kind = any (array[
      'lesson_note', 'class', 'adventure', 'background', 'building', 'asset',
      'lesson_asset', 'decoration', 'effect', 'reward', 'session',
      'course', 'smart_card'
    ])
  );

/* ------------------------------------------------------------------- posts */

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  media_url text,
  media_kind text not null default 'none',
  category text not null default 'update',
  hashtags text[] not null default '{}',
  attached_resource_id uuid references public.community_resources(id) on delete set null,
  is_promotion boolean not null default false,
  promotion_url text,
  status text not null default 'published',
  moderation_state text not null default 'approved',
  moderation_reason text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.community_posts to authenticated;
grant all on public.community_posts to service_role;

alter table public.community_posts enable row level security;

create policy "published posts are readable"
  on public.community_posts
  for select
  to authenticated
  using (status = 'published' and moderation_state <> 'rejected');

create policy "authors read their own posts"
  on public.community_posts
  for select
  to authenticated
  using (auth.uid() = author_id);

create policy "authors write their own posts"
  on public.community_posts
  for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "authors edit their own posts"
  on public.community_posts
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "authors delete their own posts"
  on public.community_posts
  for delete
  to authenticated
  using (auth.uid() = author_id);

create policy "administrators moderate posts"
  on public.community_posts
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'platform_owner') or public.has_role(auth.uid(), 'co_admin'))
  with check (public.has_role(auth.uid(), 'platform_owner') or public.has_role(auth.uid(), 'co_admin'));

create index if not exists community_posts_recent_idx on public.community_posts (created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index if not exists community_posts_hashtags_idx on public.community_posts using gin (hashtags);

/* ------------------------------------------------------------ post likes */

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

grant select, insert, delete on public.community_post_likes to authenticated;
grant all on public.community_post_likes to service_role;

alter table public.community_post_likes enable row level security;

create policy "likes are readable"
  on public.community_post_likes for select to authenticated using (true);

create policy "members like as themselves"
  on public.community_post_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "members remove their own like"
  on public.community_post_likes for delete to authenticated using (auth.uid() = user_id);

/* --------------------------------------------------------- post comments */

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  moderation_state text not null default 'approved',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.community_post_comments to authenticated;
grant all on public.community_post_comments to service_role;

alter table public.community_post_comments enable row level security;

create policy "approved comments are readable"
  on public.community_post_comments
  for select
  to authenticated
  using (moderation_state <> 'rejected');

create policy "members comment as themselves"
  on public.community_post_comments
  for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "authors delete their own comment"
  on public.community_post_comments
  for delete
  to authenticated
  using (auth.uid() = author_id);

create policy "administrators moderate comments"
  on public.community_post_comments
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'platform_owner') or public.has_role(auth.uid(), 'co_admin'))
  with check (public.has_role(auth.uid(), 'platform_owner') or public.has_role(auth.uid(), 'co_admin'));

create index if not exists community_post_comments_post_idx
  on public.community_post_comments (post_id, created_at asc);

/* ------------------------------------------------------------- post cards */

-- One read shape for the feed: post + author identity + live counts. RLS of
-- the underlying tables still applies to whoever selects from it.
create or replace view public.community_post_cards
with (security_invoker = on) as
select
  cpst.id,
  cpst.author_id,
  cpst.body,
  cpst.media_url,
  cpst.media_kind,
  cpst.category,
  cpst.hashtags,
  cpst.attached_resource_id,
  cpst.is_promotion,
  cpst.promotion_url,
  cpst.status,
  cpst.view_count,
  cpst.created_at,
  cp.username,
  coalesce(nullif(cp.display_name, ''), p.full_name, p.display_name, cp.username) as display_name,
  cp.headline,
  coalesce(nullif(cp.avatar_url, ''), p.avatar_url) as avatar_url,
  (select count(*) from public.community_post_likes l where l.post_id = cpst.id) as like_count,
  (select count(*) from public.community_post_comments c
     where c.post_id = cpst.id and c.moderation_state <> 'rejected') as comment_count
from public.community_posts cpst
left join public.community_profiles cp on cp.user_id = cpst.author_id
left join public.profiles p on p.user_id = cpst.author_id;

grant select on public.community_post_cards to authenticated;
grant all on public.community_post_cards to service_role;

/* ------------------------------------------------------------ post views */

create or replace function public.community_post_viewed(_post_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  total integer;
begin
  update public.community_posts
     set view_count = view_count + 1
   where id = _post_id
     and status = 'published'
  returning view_count into total;
  return coalesce(total, 0);
end;
$$;

grant execute on function public.community_post_viewed(uuid) to authenticated;

/* --------------------------------------------------------------- hashtags */

-- Hashtags are never a fixed list: suggestions are counted from what the
-- community has actually published, across posts and shared resources.
create or replace function public.community_hashtag_counts(
  _prefix text default null,
  _limit integer default 12
)
returns table (tag text, uses bigint)
language sql
stable
security definer
set search_path = public
as $$
  with tags as (
    select unnest(hashtags) as tag
      from public.community_resources
     where status = 'published'
    union all
    select unnest(hashtags) as tag
      from public.community_posts
     where status = 'published' and moderation_state <> 'rejected'
  )
  select t.tag, count(*) as uses
    from tags t
   where t.tag is not null
     and btrim(t.tag) <> ''
     and (
       _prefix is null or btrim(_prefix) = ''
       or t.tag ilike '%' || replace(btrim(_prefix), '#', '') || '%'
     )
   group by t.tag
   order by uses desc, t.tag asc
   limit least(coalesce(_limit, 12), 50);
$$;

grant execute on function public.community_hashtag_counts(text, integer) to anon, authenticated;
