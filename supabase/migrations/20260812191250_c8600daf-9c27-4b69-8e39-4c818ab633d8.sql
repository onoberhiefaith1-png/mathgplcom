-- 1. search_path hardening
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.username_is_valid(text) SET search_path = public;

-- 2. Revoke EXECUTE from anon on all SECURITY DEFINER functions in public,
--    keeping only the genuinely pre-login lookups.
DO $$
DECLARE
  f record;
  keep text[] := ARRAY[
    'lookup_class_by_code','lookup_session_by_code','resolve_share_code','resolve_account_code',
    'lookup_profile_by_student_id','mathgpl_id_for_email','is_community_published',
    'get_org_homepage_config','get_workspace_homepage_config','search_public_teachers'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF NOT (f.proname = ANY(keep)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
    END IF;
  END LOOP;
END $$;

-- 3. Revoke EXECUTE from authenticated on system-only routines
DO $$
DECLARE
  f record;
  internal text[] := ARRAY[
    'account_activity_score','credit_value_at','profit_percentage_at','ensure_credit_wallet',
    'ensure_user_cost_unit','ensure_workspace_cost_unit','expire_credit_grants',
    'expire_lapsed_subscriptions','recompute_cost_unit_day','record_usage_event','adjust_credits',
    'issue_account_id','issue_account_id_for_email','activate_subscription',
    'paddle_activate_paid_plan','paddle_cancel_at_period_end','paddle_schedule_plan_change',
    'paddle_set_payment_state','paddle_record_topup','paddle_apply_plan_change',
    'delete_email','enqueue_email','read_email_batch','move_to_dlq','email_queue_dispatch',
    'email_queue_wake','set_platform_building_default','reconcile_usage_costs',
    'import_platform_usage_from_credits'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname = ANY(internal)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon', f.sig);
  END LOOP;
END $$;

-- Trigger functions never need to be callable directly
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon', f.sig);
  END LOOP;
END $$;

-- 4. class_join_codes: explicit owner-only read, no write access
GRANT SELECT ON public.class_join_codes TO authenticated;
GRANT ALL ON public.class_join_codes TO service_role;
ALTER TABLE public.class_join_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class owners read their own join code" ON public.class_join_codes;
CREATE POLICY "Class owners read their own join code"
  ON public.class_join_codes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_join_codes.class_id AND c.owner_id = auth.uid()));

-- 5. community likes / downloads: own rows, or activity on my published resources
DROP POLICY IF EXISTS "Likes are readable by members" ON public.community_likes;
CREATE POLICY "Members read their own likes and likes on their resources"
  ON public.community_likes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_resources r WHERE r.id = community_likes.resource_id AND r.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Downloads are readable by members" ON public.community_downloads;
CREATE POLICY "Members read their own downloads and downloads of their resources"
  ON public.community_downloads FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_resources r WHERE r.id = community_downloads.resource_id AND r.owner_id = auth.uid())
  );

-- 6. community_profiles: own profile, published creators, or connected accounts
DROP POLICY IF EXISTS "Community profiles are readable by members" ON public.community_profiles;
CREATE POLICY "Members read their own and published creator profiles"
  ON public.community_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_resources r
      WHERE r.owner_id = community_profiles.user_id AND r.status = 'published'
    )
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
        AND ((c.from_user_id = auth.uid() AND c.to_user_id = community_profiles.user_id)
          OR (c.to_user_id = auth.uid() AND c.from_user_id = community_profiles.user_id))
    )
  );

-- 7. usage_events: an account can read its own metering rows
DROP POLICY IF EXISTS "accounts read their own usage events" ON public.usage_events;
CREATE POLICY "accounts read their own usage events"
  ON public.usage_events FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.cost_units cu
      WHERE cu.id = usage_events.cost_unit_id AND cu.user_id = auth.uid()
    )
  );
