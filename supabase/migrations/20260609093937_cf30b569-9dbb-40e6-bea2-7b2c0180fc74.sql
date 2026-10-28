-- Lock down SECURITY DEFINER helper functions so the anonymous (anon) role
-- can no longer execute them. They all depend on auth.uid() and are intended
-- for signed-in users (or are internal trigger functions).

-- 1) Functions intended to be callable by signed-in users (RPC / RLS helpers):
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.is_class_owner(uuid)',
    'public.get_owned_class_codes()',
    'public.is_class_member(uuid)',
    'public.lookup_class_by_code(text)',
    'public.notebook_shared_to_member(uuid)',
    'public.shares_class_with(uuid)',
    'public.accept_class_invitation(uuid)',
    'public.get_class_join_code(uuid)',
    'public.get_class_join_request_profiles(uuid)',
    'public.lookup_profile_by_student_id(text)',
    'public.get_class_member_names(uuid)',
    'public.can_access_realtime_topic(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', fn);
  END LOOP;
END $$;

-- 2) Trigger-only / internal functions: no direct execute for anon or authenticated.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.generate_mathgpl_id()',
    'public.handle_new_player_stats()',
    'public.handle_new_class_join_code()',
    'public.handle_new_user_profile()',
    'public.touch_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', fn);
  END LOOP;
END $$;