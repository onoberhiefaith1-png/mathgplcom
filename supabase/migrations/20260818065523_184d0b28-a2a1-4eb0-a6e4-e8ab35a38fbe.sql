-- Asset managers: platform owner, or the holder of a live asset-manager code.
CREATE OR REPLACE FUNCTION public.can_manage_gpl_assets()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'platform_owner'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.staff_codes c
        WHERE c.purpose = 'asset_manager'
          AND c.claimed_by = auth.uid()
          AND c.active
          AND c.revoked_at IS NULL
          AND (c.expires_at IS NULL OR c.expires_at > now())
      )
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_gpl_assets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_gpl_assets() TO authenticated, service_role;

-- Official asset files live under official/ in the shared bucket.
DROP POLICY IF EXISTS "Official assets readable" ON storage.objects;
CREATE POLICY "Official assets readable"
  ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'game-assets' AND (storage.foldername(name))[1] = 'official');

DROP POLICY IF EXISTS "Asset managers write official assets" ON storage.objects;
CREATE POLICY "Asset managers write official assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'game-assets'
    AND (storage.foldername(name))[1] = 'official'
    AND public.can_manage_gpl_assets()
  );

DROP POLICY IF EXISTS "Asset managers update official assets" ON storage.objects;
CREATE POLICY "Asset managers update official assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'game-assets'
    AND (storage.foldername(name))[1] = 'official'
    AND public.can_manage_gpl_assets()
  );

DROP POLICY IF EXISTS "Asset managers delete official assets" ON storage.objects;
CREATE POLICY "Asset managers delete official assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'game-assets'
    AND (storage.foldername(name))[1] = 'official'
    AND public.can_manage_gpl_assets()
  );