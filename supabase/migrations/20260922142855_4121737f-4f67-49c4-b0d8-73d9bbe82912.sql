DROP POLICY IF EXISTS "Official assets readable" ON storage.objects;
CREATE POLICY "Official assets readable"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND (storage.foldername(name))[1] = 'official'
);