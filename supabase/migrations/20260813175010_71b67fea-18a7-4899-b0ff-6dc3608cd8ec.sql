-- Privileges granted to PUBLIC still reach anon; strip those too.
DO $$
DECLARE
  fn record;
  public_fns text[] := ARRAY[
    'gateway_by_handle',
    'get_org_homepage_config',
    'get_platform_free_building',
    'get_site_stats',
    'is_community_published',
    'lookup_class_by_code',
    'lookup_session_by_code',
    'resolve_account_code',
    'resolve_share_code'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'execute')
      AND NOT (p.proname = ANY (public_fns))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    -- Signed-in callers keep the access their own grants gave them; trusted
    -- server code keeps running these routines.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

-- Restore the signed-in grants the app itself relies on.
GRANT EXECUTE ON FUNCTION public.credit_headroom(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_allows_ai(uuid, uuid) TO authenticated;

-- Trigger functions stay callable by nobody but the trigger itself.
REVOKE ALL ON FUNCTION public.enforce_class_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_class_student_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_admin_role_changes() FROM PUBLIC, anon, authenticated;