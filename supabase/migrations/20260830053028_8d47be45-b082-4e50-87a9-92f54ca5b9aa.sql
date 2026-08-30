-- Community profile media (photo, cover, introduction video).
drop policy if exists "community media readable" on storage.objects;
create policy "community media readable"
  on storage.objects for select
  using (bucket_id = 'community-media');

drop policy if exists "community media owner insert" on storage.objects;
create policy "community media owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "community media owner update" on storage.objects;
create policy "community media owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "community media owner delete" on storage.objects;
create policy "community media owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );