-- Lock down SECURITY DEFINER helpers: revoke from PUBLIC + anon, grant only to authenticated + service_role.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'is_class_member',
        'is_class_owner',
        'lookup_class_by_code',
        'lookup_profile_by_student_id',
        'get_class_join_code',
        'shares_class_with',
        'can_access_realtime_topic',
        'notebook_shared_to_member',
        'get_class_join_request_profiles',
        'get_class_member_names',
        'get_owned_class_codes',
        'accept_class_invitation'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', fn.proname, fn.args);
  END LOOP;
END $$;