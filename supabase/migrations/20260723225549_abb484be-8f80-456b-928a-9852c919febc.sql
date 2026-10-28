DROP POLICY IF EXISTS "Class members read teacher game files" ON storage.objects;

CREATE POLICY "Class members read teacher game files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'game-assets'
  AND EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.user_id = auth.uid()
      AND (c.owner_id)::text = (storage.foldername(storage.objects.name))[1]
      AND (
        EXISTS (
          SELECT 1 FROM public.class_game_boards cgb
          JOIN public.games g ON g.id = cgb.game_id
          WHERE cgb.class_id = cm.class_id AND g.owner_id = c.owner_id
        )
        OR EXISTS (
          SELECT 1 FROM public.class_games cg
          JOIN public.games g ON g.id = cg.game_id
          WHERE cg.class_id = cm.class_id AND g.owner_id = c.owner_id
        )
      )
  )
);