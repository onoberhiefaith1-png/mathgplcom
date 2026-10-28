create policy "Class members read teacher game files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'game-assets'
  and exists (
    select 1
    from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.user_id = auth.uid()
      and c.owner_id::text = (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.class_game_boards cgb
          join public.games g on g.id = cgb.game_id
          where cgb.class_id = cm.class_id
            and g.owner_id = c.owner_id
        )
        or exists (
          select 1
          from public.class_games cg
          join public.games g on g.id = cg.game_id
          where cg.class_id = cm.class_id
            and g.owner_id = c.owner_id
        )
      )
  )
);