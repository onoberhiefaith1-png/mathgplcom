-- 1) Remove blanket PUBLIC execute on every SECURITY DEFINER function in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;

-- Intended pre-auth entry points keep explicit grants
GRANT EXECUTE ON FUNCTION public.lookup_session_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_account_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_share_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_homepage_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_published(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_homepage_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_teachers(text) TO authenticated;

-- 2) sessions.session_code must not be readable by audience / unrelated users
REVOKE SELECT ON public.sessions FROM anon, authenticated;

GRANT SELECT (
  id, owner_id, class_id, notebook_id, title, description, starts_at,
  duration_minutes, time_zone, visibility, status, created_at, updated_at,
  broadcasts, ask_participant_name
) ON public.sessions TO authenticated;

GRANT SELECT (
  id, class_id, notebook_id, title, description, starts_at,
  duration_minutes, time_zone, visibility, status, created_at, updated_at,
  broadcasts, ask_participant_name
) ON public.sessions TO anon;

CREATE OR REPLACE FUNCTION public.my_session_code(_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.session_code
  FROM public.sessions s
  WHERE s.id = _session_id
    AND s.owner_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_session_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_session_code(uuid) TO authenticated;

-- 3) Tighten smart-card-previews storage policies to explicit per-command rules
DROP POLICY IF EXISTS "Owners manage their smart card previews" ON storage.objects;

CREATE OR REPLACE FUNCTION public.owns_smart_card_preview(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$'
     AND EXISTS (
       SELECT 1 FROM public.smart_cards c
       WHERE c.owner_id = auth.uid()
         AND c.id::text = replace(_name, '.png', '')
     )
$$;

REVOKE ALL ON FUNCTION public.owns_smart_card_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_smart_card_preview(text) TO authenticated;

CREATE POLICY "Smart card preview owners read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'smart-card-previews' AND public.owns_smart_card_preview(name));

CREATE POLICY "Smart card preview owners insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'smart-card-previews' AND public.owns_smart_card_preview(name));

CREATE POLICY "Smart card preview owners update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'smart-card-previews' AND public.owns_smart_card_preview(name))
WITH CHECK (bucket_id = 'smart-card-previews' AND public.owns_smart_card_preview(name));

CREATE POLICY "Smart card preview owners delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'smart-card-previews' AND public.owns_smart_card_preview(name));