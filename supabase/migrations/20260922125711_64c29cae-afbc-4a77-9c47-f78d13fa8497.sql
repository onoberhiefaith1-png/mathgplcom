drop policy if exists "Everyone reads capabilities" on public.role_capabilities;

create policy "Members read capabilities for their roles"
on public.role_capabilities
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role = role_capabilities.role
  )
  or public.has_role((select auth.uid()), 'platform_owner'::public.app_role)
  or public.has_role((select auth.uid()), 'co_admin'::public.app_role)
);

drop policy if exists "guide videos are readable" on storage.objects;

create policy "published guide videos are readable"
on storage.objects
for select
to public
using (
  bucket_id = 'page-guides'
  and (
    public.can_manage_tutorials()
    or exists (
      select 1
      from public.page_guides g
      where g.video_path = storage.objects.name
        and g.status = 'published'
    )
    or exists (
      select 1
      from public.page_guide_videos v
      where v.video_path = storage.objects.name
        and v.status = 'published'
    )
  )
);

drop policy if exists "community media readable" on storage.objects;

create policy "visible community media is readable"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'community-media'
  and (
    owner = (select auth.uid())
    or owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.community_profiles p
      where storage.objects.name in (p.avatar_url, p.cover_url, p.intro_video_url)
        and (
          p.user_id = (select auth.uid())
          or exists (
            select 1
            from public.community_resources r
            where r.owner_id = p.user_id
              and r.status = 'published'
          )
          or exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (c.from_user_id = (select auth.uid()) and c.to_user_id = p.user_id)
                or (c.to_user_id = (select auth.uid()) and c.from_user_id = p.user_id)
              )
          )
        )
    )
    or exists (
      select 1
      from public.community_posts p
      where p.media_url = storage.objects.name
        and (
          p.author_id = (select auth.uid())
          or (p.status = 'published' and p.moderation_state <> 'rejected')
        )
    )
  )
);