ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_until timestamptz;

CREATE OR REPLACE FUNCTION public.downgrade_to_free_plan(_sub_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; v_free text;
BEGIN
  SELECT s.id, s.user_id, s.org_id, s.plan_id, s.plan INTO r
    FROM public.subscriptions s WHERE s.id = _sub_id;
  IF r.id IS NULL THEN RETURN; END IF;

  UPDATE public.subscriptions
     SET status = 'canceled', grace_until = NULL, updated_at = now()
   WHERE id = r.id;

  SELECT p2.key INTO v_free
    FROM public.plans p2
    JOIN public.plans p1 ON p1.key = coalesce(r.plan_id, r.plan)
   WHERE p2.audience = p1.audience
     AND p2.is_free AND p2.active AND p2.status = 'available'
   ORDER BY p2.sort_order LIMIT 1;

  IF v_free IS NOT NULL AND r.user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.activate_subscription(r.user_id, v_free, r.org_id, 'none', NULL, 0, 30);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $function$;

REVOKE EXECUTE ON FUNCTION public.downgrade_to_free_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_to_free_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; v_count int := 0; v_grace int := 7;
BEGIN
  FOR r IN
    SELECT s.id FROM public.subscriptions s
     WHERE s.status = 'active' AND s.cancel_at IS NOT NULL AND s.cancel_at <= now()
  LOOP
    PERFORM public.downgrade_to_free_plan(r.id);
    v_count := v_count + 1;
  END LOOP;

  FOR r IN
    SELECT s.id, s.period_end FROM public.subscriptions s
     WHERE s.status = 'active'
       AND coalesce(s.final_price, 0) > 0
       AND s.period_end IS NOT NULL
       AND s.period_end <= now()
  LOOP
    UPDATE public.subscriptions
       SET status = 'expired',
           grace_until = coalesce(grace_until, r.period_end + (v_grace || ' days')::interval),
           updated_at = now()
     WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  FOR r IN
    SELECT s.id FROM public.subscriptions s
     WHERE s.status = 'expired' AND s.grace_until IS NOT NULL AND s.grace_until <= now()
  LOOP
    PERFORM public.downgrade_to_free_plan(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.credit_headroom(_user_id uuid, _org_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(enforced boolean, balance numeric, reserved numeric, available numeric, start_floor numeric, stop_floor numeric, blocked_reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit uuid; v_balance numeric; v_reserved numeric; v_state text; v_status text;
  v_start numeric; v_stop numeric; v_staff boolean := false; v_enabled boolean := true;
BEGIN
  SELECT coalesce(s.credit_start_floor, 0.50), coalesce(s.credit_stop_floor, 0.30)
    INTO v_start, v_stop FROM public.platform_cost_settings s WHERE s.id = 1;
  v_start := coalesce(v_start, 0.50); v_stop := coalesce(v_stop, 0.30);

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, v_start, v_stop, NULL::text;
    RETURN;
  END IF;

  SELECT coalesce(cu.credit_usage_enabled, true) INTO v_enabled
    FROM public.cost_units cu WHERE cu.id = v_unit;

  SELECT true INTO v_staff
  FROM public.staff_redemptions r JOIN public.staff_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > now()) LIMIT 1;

  SELECT w.balance, w.reserved INTO v_balance, v_reserved
  FROM public.credit_wallets w WHERE w.cost_unit_id = v_unit;

  SELECT s.payment_state INTO v_state FROM public.subscriptions s
   WHERE s.cost_unit_id = v_unit AND s.status = 'active'
     AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
   ORDER BY s.period_start DESC LIMIT 1;

  IF v_state IS NULL THEN
    SELECT s.status INTO v_status FROM public.subscriptions s
     WHERE s.cost_unit_id = v_unit AND s.status = 'expired'
     ORDER BY s.period_end DESC NULLS LAST LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    NOT coalesce(v_staff, false),
    coalesce(v_balance, 0),
    coalesce(v_reserved, 0),
    coalesce(v_balance, 0) - coalesce(v_reserved, 0),
    v_start, v_stop,
    CASE WHEN NOT coalesce(v_enabled, true) THEN 'disabled'
         WHEN coalesce(v_staff, false) THEN NULL
         WHEN coalesce(v_state, 'ok') = 'past_due' THEN 'past_due'
         WHEN v_status = 'expired' THEN 'expired' ELSE NULL END;
END $function$;

DROP POLICY IF EXISTS "Members can view their own credit grants" ON public.credit_grants;
CREATE POLICY "Only the platform owner can view credit grants"
  ON public.credit_grants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'::public.app_role));