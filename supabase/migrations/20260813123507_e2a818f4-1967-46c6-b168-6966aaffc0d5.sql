CREATE OR REPLACE FUNCTION public.paddle_activate_paid_plan(_user_id uuid, _plan_key text, _provider_sub_id text, _amount numeric DEFAULT NULL::numeric, _period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, _customer_id text DEFAULT NULL::text, _billing_interval text DEFAULT 'monthly')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_sub uuid; v_customer text; v_existing uuid; v_days integer;
BEGIN
  SELECT active_org_id INTO v_org FROM public.profiles WHERE user_id = _user_id;

  -- The same payment delivered twice must not activate twice or grant credits twice.
  SELECT t.subscription_id INTO v_existing
    FROM public.payment_transactions t
    JOIN public.subscriptions s ON s.id = t.subscription_id
   WHERE t.provider = 'paddle' AND t.provider_ref = _provider_sub_id
     AND t.status = 'succeeded' AND t.plan_id = _plan_key
     AND s.status = 'active'
   ORDER BY t.occurred_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.subscriptions
       SET period_end = coalesce(_period_end, period_end),
           payment_state = 'ok',
           cancel_at = NULL,
           scheduled_plan_id = NULL,
           provider_customer_id = coalesce(_customer_id, provider_customer_id),
           updated_at = now()
     WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  SELECT coalesce(_customer_id, s.provider_customer_id) INTO v_customer
    FROM public.subscriptions s
   WHERE s.provider_subscription_id = _provider_sub_id
   ORDER BY s.period_start DESC LIMIT 1;

  v_days := greatest(
    coalesce(
      extract(day from (coalesce(_period_end,
        now() + CASE WHEN lower(coalesce(_billing_interval,'monthly')) = 'yearly'
                     THEN interval '365 days' ELSE interval '30 days' END) - now()))::int,
      CASE WHEN lower(coalesce(_billing_interval,'monthly')) = 'yearly' THEN 365 ELSE 30 END),
    1);

  v_sub := public.activate_subscription(
    _user_id, _plan_key, v_org, 'paddle', _provider_sub_id, _amount, v_days,
    coalesce(_billing_interval, 'monthly')
  );

  UPDATE public.subscriptions
     SET period_end = coalesce(_period_end, period_end),
         payment_state = 'ok',
         cancel_at = NULL,
         scheduled_plan_id = NULL,
         provider_customer_id = coalesce(_customer_id, v_customer),
         updated_at = now()
   WHERE id = v_sub;

  RETURN v_sub;
END $function$;