-- Community discovery ranking
create or replace function public.community_directory_ranked(
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
  accepts_requests boolean,
  shared_count integer,
  student_count integer,
  like_count integer,
  post_count integer,
  live_count integer,
  prominence numeric
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
  ),
  filtered as (
    select * from base b
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
  ),
  metrics as (
    select
      f.user_id,
      (
        select count(*) from public.community_resources cr
        where cr.owner_id = f.user_id and cr.status = 'published'
      ) as shared_count,
      (
        select count(distinct cm.user_id)
        from public.classes c
        join public.class_members cm on cm.class_id = c.id
        where c.owner_id = f.user_id
      ) as student_count,
      (
        select count(*)
        from public.community_likes cl
        join public.community_resources cr on cr.id = cl.resource_id
        where cr.owner_id = f.user_id
      )
      + (
        select count(*)
        from public.community_downloads cd
        join public.community_resources cr2 on cr2.id = cd.resource_id
        where cr2.owner_id = f.user_id
      ) as like_count,
      (
        select count(*) from public.community_posts cpo
        where cpo.author_id = f.user_id and cpo.status = 'published'
      )
      + (
        select count(*)
        from public.community_post_likes cpl
        join public.community_posts cpo2 on cpo2.id = cpl.post_id
        where cpo2.author_id = f.user_id
      ) as post_count,
      (
        select count(*) from public.sessions s where s.owner_id = f.user_id
      ) as live_count
    from filtered f
  )
  select
    f.user_id,
    f.username,
    f.role_kind,
    f.display_name,
    f.headline,
    case when f.role_kind = 'student' then null else f.location end,
    case when f.role_kind = 'student' then null else f.country end,
    f.avatar_url,
    f.cover_url,
    f.cover_kind,
    f.intro_video_url,
    f.bio,
    f.professional,
    f.years_experience,
    f.view_count,
    f.accepts_requests,
    m.shared_count::integer,
    m.student_count::integer,
    m.like_count::integer,
    m.post_count::integer,
    m.live_count::integer,
    (
      least(m.student_count, 500) * 0.5
      + least(m.shared_count, 100) * 3.0
      + least(m.like_count, 500) * 1.0
      + least(m.post_count, 300) * 0.6
      + least(coalesce(f.view_count, 0), 2000) * 0.15
      + least(m.live_count, 50) * 2.0
      + least(coalesce(f.years_experience, 0), 40) * 1.0
    )::numeric as prominence
  from filtered f
  join metrics m on m.user_id = f.user_id
  order by prominence desc, f.display_name asc, f.username asc
  limit least(coalesce(_limit, 60), 200);
$$;

grant execute on function public.community_directory_ranked(text, text, integer) to anon, authenticated;

create or replace function public.community_member_stats(_username text)
returns table (
  shared_count integer,
  student_count integer,
  like_count integer,
  post_count integer,
  live_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select cp.user_id
    from public.community_profiles cp
    where cp.username = _username
      and cp.is_listed = true
      and cp.moderation_state <> 'rejected'
    limit 1
  )
  select
    (select count(*) from public.community_resources cr
      where cr.owner_id = t.user_id and cr.status = 'published')::integer,
    (select count(distinct cm.user_id)
      from public.classes c
      join public.class_members cm on cm.class_id = c.id
      where c.owner_id = t.user_id)::integer,
    (select count(*)
      from public.community_likes cl
      join public.community_resources cr on cr.id = cl.resource_id
      where cr.owner_id = t.user_id)::integer,
    (select count(*) from public.community_posts cpo
      where cpo.author_id = t.user_id and cpo.status = 'published')::integer,
    (select count(*) from public.sessions s where s.owner_id = t.user_id)::integer
  from target t;
$$;

grant execute on function public.community_member_stats(text) to anon, authenticated;