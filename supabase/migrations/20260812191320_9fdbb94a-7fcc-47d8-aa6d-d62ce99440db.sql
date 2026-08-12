DO $$
DECLARE
  f record;
  public_ok text[] := ARRAY[
    'lookup_class_by_code','lookup_session_by_code','resolve_share_code','resolve_account_code',
    'lookup_profile_by_student_id','mathgpl_id_for_email','is_community_published',
    'get_org_homepage_config','get_workspace_homepage_config','search_public_teachers'
  ];
  internal text[] := ARRAY[
    'account_activity_score','credit_value_at','profit_percentage_at','ensure_credit_wallet',
    'ensure_user_cost_unit','ensure_workspace_cost_unit','expire_credit_grants',
    'expire_lapsed_subscriptions','recompute_cost_unit_day','record_usage_event','adjust_credits',
    'issue_account_id','issue_account_id_for_email','activate_subscription',
    'paddle_activate_paid_plan','paddle_cancel_at_period_end','paddle_schedule_plan_change',
    'paddle_set_payment_state','paddle_record_topup','paddle_apply_plan_change',
    'delete_email','enqueue_email','read_email_batch','move_to_dlq','email_queue_dispatch',
    'email_queue_wake','set_platform_building_default','reconcile_usage_costs'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    IF f.proname = ANY(public_ok) THEN
      CONTINUE;
    END IF;

    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);

    IF NOT f.is_trigger AND NOT (f.proname = ANY(internal)) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;
