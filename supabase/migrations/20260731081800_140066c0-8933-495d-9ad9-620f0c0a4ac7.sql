-- 1. SECURITY DEFINER function execution privileges
REVOKE EXECUTE ON FUNCTION public.handle_new_user_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_class_join_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_player_stats() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('handle_new_user_account','handle_new_user_profile','handle_new_class_join_code','handle_new_player_stats')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

-- Public entry points that must stay reachable before sign-in (share/join links)
GRANT EXECUTE ON FUNCTION public.lookup_session_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_access_realtime_topic(text) TO anon;

-- 2. class_join_codes: drop dead deny-all policy, rely on default-deny + SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Deny direct access to class_join_codes" ON public.class_join_codes;
REVOKE ALL ON TABLE public.class_join_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.class_join_codes TO service_role;

-- 3. smart_card_attempts: no anonymous read of participant identities
DROP POLICY IF EXISTS "Attempts on published cards are public" ON public.smart_card_attempts;
CREATE POLICY "Signed-in users read attempts on published cards"
ON public.smart_card_attempts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.smart_cards c WHERE c.id = smart_card_attempts.card_id AND c.published = true));
REVOKE SELECT ON TABLE public.smart_card_attempts FROM anon;

-- 4. storage: exact file match instead of prefix LIKE
DROP POLICY IF EXISTS "Owners manage their smart card previews" ON storage.objects;
CREATE POLICY "Owners manage their smart card previews"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'smart-card-previews'
  AND EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.owner_id = auth.uid()
      AND storage.filename(objects.name) = c.id::text || '.png'
      AND coalesce(array_length(storage.foldername(objects.name), 1), 0) = 0
  )
)
WITH CHECK (
  bucket_id = 'smart-card-previews'
  AND EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.owner_id = auth.uid()
      AND storage.filename(objects.name) = c.id::text || '.png'
      AND coalesce(array_length(storage.foldername(objects.name), 1), 0) = 0
  )
);