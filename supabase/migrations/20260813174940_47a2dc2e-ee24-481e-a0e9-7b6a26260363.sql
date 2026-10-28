-- 1. Trigger functions must never be directly callable by API roles.
REVOKE ALL ON FUNCTION public.enforce_class_limit() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_class_student_limit() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_admin_role_changes() FROM anon, authenticated;

-- 2. Anonymous visitors keep only the genuinely public routines.
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
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY (public_fns))
      AND has_function_privilege('anon', p.oid, 'execute')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
  END LOOP;
END $$;

-- 3. Privileged server-only routines: trusted server code (service_role) only.
DO $$
DECLARE
  fn record;
  server_only text[] := ARRAY[
    'activate_subscription',
    'paddle_activate_paid_plan',
    'paddle_record_topup',
    'paddle_set_payment_state',
    'paddle_cancel_at_period_end',
    'paddle_schedule_plan_change',
    'snapshot_subscription_terms',
    'downgrade_to_free_plan',
    'expire_lapsed_subscriptions',
    'expire_credit_grants',
    'record_usage_event',
    'reserve_credits',
    'settle_credit_reservation',
    'release_expired_reservations',
    'consume_credits',
    'consume_cost_credits',
    'adjust_credits',
    'reconcile_usage_costs',
    'record_pricing_version',
    'resolve_credit_pricing',
    'resolve_cost_unit',
    'publish_plan_version',
    'save_plan_draft',
    'enqueue_email',
    'read_email_batch',
    'delete_email',
    'move_to_dlq',
    'import_platform_usage_from_ledger'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY (server_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;