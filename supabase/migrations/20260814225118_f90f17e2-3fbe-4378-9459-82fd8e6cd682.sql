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

  -- Free-access accounts (platform test accounts, access-code holders) are never metered.
  IF _user_id IS NOT NULL AND public.has_free_access(_user_id) THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, v_start, v_stop, NULL::text;
    RETURN;
  END IF;

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

CREATE OR REPLACE FUNCTION public.plan_allows_ai(_user_id uuid, _org_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_unit uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user_id, 'platform_owner') OR public.has_role(_user_id, 'co_admin')
     OR public.has_role(_user_id, 'student') THEN
    RETURN true;
  END IF;

  IF public.has_free_access(_user_id) THEN
    RETURN true;
  END IF;

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.staff_redemptions r JOIN public.staff_codes c ON c.id = r.code_id
              WHERE r.cost_unit_id = v_unit AND r.active AND c.active
                AND (c.expires_at IS NULL OR c.expires_at > now())) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.cost_unit_id = v_unit AND s.status = 'active' AND s.plan <> 'free'
       AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
  );
END $function$;