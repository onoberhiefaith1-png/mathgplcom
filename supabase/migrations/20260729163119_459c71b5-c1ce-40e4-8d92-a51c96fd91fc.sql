CREATE POLICY "Owners manage their smart card previews"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'smart-card-previews'
  AND EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.owner_id = auth.uid()
      AND storage.objects.name LIKE c.id::text || '%'
  )
)
WITH CHECK (
  bucket_id = 'smart-card-previews'
  AND EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.owner_id = auth.uid()
      AND storage.objects.name LIKE c.id::text || '%'
  )
);