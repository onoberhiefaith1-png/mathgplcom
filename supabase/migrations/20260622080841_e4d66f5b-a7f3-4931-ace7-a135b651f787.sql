
CREATE POLICY "owner reads own floating-knowledge" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'floating-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owner uploads own floating-knowledge" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'floating-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owner updates own floating-knowledge" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'floating-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owner deletes own floating-knowledge" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'floating-knowledge' AND (storage.foldername(name))[1] = auth.uid()::text);
